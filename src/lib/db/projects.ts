import { randomUUID } from "node:crypto";

import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  getMockProjectMembership,
  getMockProjectRow,
  getMockScriptDoc,
  listMockProjects,
  upsertMockProjectMembership,
} from "./mocks";
import { fetchLatestScriptDoc } from "./scriptDocs";
import type { ScriptDocRecordType } from "./scriptDocs";
import type { ProjectMemberRow, ProjectRow } from "./schema";
import type { ScriptDoc } from "@/lib/scriptDoc";
import { recordFlowMetric, withSpan } from "@/lib/observability";

export interface ProjectSummary {
  id: string;
  title: string;
  scriptType: string;
  genre: string | null;
  logline: string | null;
  status: ProjectRow["status"];
  createdAt: string;
  updatedAt: string;
  ownerId: string | null;
  targetLength?: { unit: ProjectRow["target_length_unit"]; value: number | null };
  tags: string[];
}

export interface ListProjectsOptions {
  search?: string;
  status?: ProjectRow["status"];
  limit?: number;
  cursor?: string;
  userId?: string;
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
  ownerId: string;
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
    ownerId: row.owner_id,
    targetLength: row.target_length_unit
      ? { unit: row.target_length_unit, value: row.target_length_value }
      : undefined,
    tags: row.tags ?? [],
  };
}

async function resolveAccessibleProjectIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    const owned = localProjects
      .filter((project) => project.ownerId === userId)
      .map((project) => project.id);
    const mockProjects = listMockProjects()
      .map(mapProjectRow)
      .filter((project) => Boolean(getMockProjectMembership(project.id, userId)))
      .map((project) => project.id);
    return Array.from(new Set([...owned, ...mockProjects]));
  }

  const supabase = getSupabaseClient();
  const ids = new Set<string>();

  const { data: owned, error: ownedError } = await supabase
    .from<ProjectRow>("projects")
    .select("id")
    .eq("owner_id", userId);

  if (ownedError) {
    console.error("Failed to load owned project ids", ownedError);
    throw ownedError;
  }

  owned?.forEach((row) => ids.add(row.id));

  const { data: memberships, error: membershipError } = await supabase
    .from<ProjectMemberRow>("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error("Failed to load project memberships", membershipError);
    throw membershipError;
  }

  memberships?.forEach((row) => ids.add(row.project_id));

  return Array.from(ids);
}

export async function listProjects(
  options: ListProjectsOptions = {},
): Promise<ListProjectsResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  if (!isSupabaseConfigured()) {
    let projects = [...listMockProjects().map(mapProjectRow), ...localProjects];
    if (options.userId) {
      projects = projects.filter((project) => {
        if (project.ownerId === options.userId) {
          return true;
        }
        return Boolean(getMockProjectMembership(project.id, options.userId));
      });
    }
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

  if (options.userId) {
    const accessibleIds = await resolveAccessibleProjectIds(options.userId);
    if (!accessibleIds.length) {
      return { projects: [], total: 0, hasMore: false };
    }
    query = query.in("id", accessibleIds);
  }

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
  scriptDocSource: ScriptDocRecordType | null;
  scriptDocVersionNumber: number | null;
}

export async function getStudioHydration(
  projectId: string,
): Promise<StudioHydrationPayload> {
  if (!isSupabaseConfigured()) {
    const project = (await getProject(projectId)) ?? mapProjectRow(getMockProjectRow());
    return {
      project,
      scriptDoc: getMockScriptDoc(),
      scriptDocSource: "version",
      scriptDocVersionNumber: 1,
    };
  }

  const [project, scriptDocRecord] = await Promise.all([
    getProject(projectId),
    fetchLatestScriptDoc(projectId, { preferAutosave: true }),
  ]);

  return {
    project,
    scriptDoc: scriptDocRecord?.doc ?? null,
    scriptDocSource: scriptDocRecord?.recordType ?? null,
    scriptDocVersionNumber: scriptDocRecord?.versionNumber ?? null,
  };
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectSummary> {
  const usesSupabase = isSupabaseConfigured();
  const storage = usesSupabase ? "supabase" : "local";

  return withSpan(
    {
      name: "onboarding.create-project",
      attributes: {
        storage,
        scriptType: input.scriptType,
      },
    },
    async (span) => {
      try {
        if (!usesSupabase) {
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
            ownerId: input.ownerId,
            targetLength: input.targetLength,
            tags: input.tags ?? [],
          };
          localProjects.push(summary);
          upsertMockProjectMembership(summary.id, input.ownerId, "owner");
          recordFlowMetric("onboarding_events_total", "Count of onboarding events", {
            event: "project.create",
            result: "created",
            storage,
          });
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
          owner_id: input.ownerId,
        };

        const { data, error } = await supabase
          .from<ProjectRow>("projects")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        recordFlowMetric("onboarding_events_total", "Count of onboarding events", {
          event: "project.create",
          result: "created",
          storage,
        });
        span.setAttribute("project.id", data.id);
        return mapProjectRow(data);
      } catch (error) {
        recordFlowMetric("onboarding_events_total", "Count of onboarding events", {
          event: "project.create",
          result: "error",
          storage,
        });
        console.error("Failed to create project", error);
        throw error;
      }
    },
  );
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
