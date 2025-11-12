import { randomUUID } from "node:crypto";

import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  getMockProjectRow,
  getMockScriptDoc,
  listMockProjects,
} from "./mocks";
import { fetchLatestScriptDoc } from "./scriptDocs";
import type { ProjectRow } from "./schema";
import type { ScriptDoc } from "@/lib/scriptDoc";

export interface ProjectSummary {
  id: string;
  title: string;
  scriptType: string;
  genre: string | null;
  logline: string | null;
  status: ProjectRow["status"];
  createdAt: string;
  updatedAt: string;
  targetLength?: { unit: ProjectRow["target_length_unit"]; value: number | null };
  tags: string[];
}

export interface ListProjectsOptions {
  search?: string;
  status?: ProjectRow["status"];
  limit?: number;
  cursor?: string;
}

export interface ListProjectsResult {
  projects: ProjectSummary[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateProjectInput {
  title: string;
  scriptType: string;
  genre?: string | null;
  logline?: string | null;
  status?: ProjectRow["status"];
  targetLength?: { unit: ProjectRow["target_length_unit"]; value?: number | null };
  tags?: string[];
}

export interface UpdateProjectInput {
  title?: string;
  scriptType?: string;
  genre?: string | null;
  logline?: string | null;
  status?: ProjectRow["status"];
  targetLength?: { unit: ProjectRow["target_length_unit"]; value?: number | null } | null;
  tags?: string[] | null;
}

const localProjects: ProjectSummary[] = [];

function mapProjectRow(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    scriptType: row.script_type,
    genre: row.genre,
    logline: row.logline,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targetLength: row.target_length_unit
      ? { unit: row.target_length_unit, value: row.target_length_value }
      : undefined,
    tags: row.tags ?? [],
  };
}

export async function listProjects(
  options: ListProjectsOptions = {},
): Promise<ListProjectsResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  if (!isSupabaseConfigured()) {
    let projects = [...listMockProjects().map(mapProjectRow), ...localProjects];
    if (options.status) {
      projects = projects.filter((project) => project.status === options.status);
    }
    if (options.search) {
      const query = options.search.toLowerCase();
      projects = projects.filter(
        (project) =>
          project.title.toLowerCase().includes(query) ||
          (project.logline ?? "").toLowerCase().includes(query),
      );
    }

    return {
      projects: projects.slice(0, limit),
      total: projects.length,
      hasMore: projects.length > limit,
      nextCursor: undefined,
    };
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from<ProjectRow>("projects")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(limit + 1);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.search) {
    const term = options.search.trim();
    query = query.or(
      `title.ilike.%${term}%,logline.ilike.%${term}%`,
    );
  }

  if (options.cursor) {
    query = query.lt("updated_at", options.cursor);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to list projects", error);
    throw error;
  }

  const hasMore = (data?.length ?? 0) > limit;
  const rows = (hasMore ? data?.slice(0, -1) : data) ?? [];

  return {
    projects: rows.map(mapProjectRow),
    total: count ?? rows.length,
    hasMore,
    nextCursor: hasMore ? rows[rows.length - 1]?.updated_at : undefined,
  };
}

export async function getProject(projectId: string): Promise<ProjectSummary | null> {
  if (!isSupabaseConfigured()) {
    const project = localProjects.find((item) => item.id === projectId);
    if (project) {
      return { ...project };
    }
    const mock = getMockProjectRow();
    return mock.id === projectId ? mapProjectRow(mock) : null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ProjectRow>("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to load project", error);
    throw error;
  }

  return data ? mapProjectRow(data) : null;
}

export interface StudioHydrationPayload {
  project: ProjectSummary | null;
  scriptDoc: ScriptDoc | null;
}

export async function getStudioHydration(
  projectId: string,
): Promise<StudioHydrationPayload> {
  if (!isSupabaseConfigured()) {
    const project = (await getProject(projectId)) ?? mapProjectRow(getMockProjectRow());
    return {
      project,
      scriptDoc: getMockScriptDoc(),
    };
  }

  const [project, scriptDoc] = await Promise.all([
    getProject(projectId),
    fetchLatestScriptDoc(projectId),
  ]);

  return { project, scriptDoc };
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectSummary> {
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const summary: ProjectSummary = {
      id: `local-${randomUUID()}`,
      title: input.title,
      scriptType: input.scriptType,
      genre: input.genre ?? null,
      logline: input.logline ?? null,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now,
      targetLength: input.targetLength,
      tags: input.tags ?? [],
    };
    localProjects.push(summary);
    return summary;
  }

  const supabase = getSupabaseClient();
  const payload = {
    title: input.title,
    script_type: input.scriptType,
    genre: input.genre ?? null,
    logline: input.logline ?? null,
    status: input.status ?? "draft",
    target_length_unit: input.targetLength?.unit ?? null,
    target_length_value: input.targetLength?.value ?? null,
    tags: input.tags ?? [],
  };

  const { data, error } = await supabase
    .from<ProjectRow>("projects")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create project", error);
    throw error;
  }

  return mapProjectRow(data);
}

export async function updateProject(
  projectId: string,
  updates: UpdateProjectInput,
): Promise<ProjectSummary | null> {
  if (!isSupabaseConfigured()) {
    const existingIndex = localProjects.findIndex((item) => item.id === projectId);
    if (existingIndex >= 0) {
      const merged: ProjectSummary = {
        ...localProjects[existingIndex],
        ...updates,
        targetLength:
          updates.targetLength === null
            ? undefined
            : updates.targetLength ?? localProjects[existingIndex].targetLength,
        tags: updates.tags ?? localProjects[existingIndex].tags,
        updatedAt: new Date().toISOString(),
      };
      localProjects[existingIndex] = merged;
      return { ...merged };
    }
    const mock = getMockProjectRow();
    if (mock.id !== projectId) {
      return null;
    }
    return {
      ...mapProjectRow(mock),
      ...updates,
      targetLength:
        updates.targetLength === null
          ? undefined
          : updates.targetLength ?? mapProjectRow(mock).targetLength,
      tags: updates.tags ?? mapProjectRow(mock).tags,
      updatedAt: new Date().toISOString(),
    };
  }

  const supabase = getSupabaseClient();
  const payload: Partial<ProjectRow> = {
    title: updates.title,
    script_type: updates.scriptType,
    genre: updates.genre ?? null,
    logline: updates.logline ?? null,
    status: updates.status,
    target_length_unit: updates.targetLength?.unit ?? null,
    target_length_value: updates.targetLength?.value ?? null,
    tags: updates.tags ?? undefined,
  };

  const { data, error } = await supabase
    .from<ProjectRow>("projects")
    .update(payload)
    .eq("id", projectId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to update project", error);
    throw error;
  }

  return data ? mapProjectRow(data) : null;
}
