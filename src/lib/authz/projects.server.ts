import { getSupabaseClient } from "@/lib/db/client";
import { isSupabaseConfigured } from "@/lib/db/config";
import type { ProjectMemberRow, ProjectRow } from "@/lib/db/schema";
import { getMockProjectMembership } from "@/lib/db/mocks";

export type ProjectRole = "owner" | "editor" | "member" | "viewer";

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

const ROLE_PRIORITY: Record<ProjectRole, number> = {
  owner: 3,
  editor: 2,
  member: 1,
  viewer: 0,
};

export class ProjectAuthorizationError extends Error {
  constructor(message = "You do not have access to this project") {
    super(message);
    this.name = "ProjectAuthorizationError";
  }
}

async function fetchSupabaseMembership(
  projectId: string,
  userId: string,
): Promise<ProjectMembership | null> {
  const supabase = getSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from<ProjectRow>("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("Failed to load project owner", projectError);
    throw projectError;
  }

  if (!project) {
    return null;
  }

  if (project.owner_id === userId) {
    return { projectId, userId, role: "owner" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from<ProjectMemberRow>("project_members")
    .select("project_id, user_id, role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError && membershipError.code !== "PGRST116") {
    console.error("Failed to load project membership", membershipError);
    throw membershipError;
  }

  if (!membership) {
    return null;
  }

  const role =
    membership.role === "admin"
      ? "editor"
      : (membership.role as ProjectRole) ?? "member";

  return { projectId, userId, role };
}

async function getProjectMembership(
  projectId: string,
  userId: string,
): Promise<ProjectMembership | null> {
  if (!isSupabaseConfigured()) {
    return getMockProjectMembership(projectId, userId);
  }

  return fetchSupabaseMembership(projectId, userId);
}

export async function ensureProjectMembership(
  projectId: string,
  userId: string,
  options: { minimumRole?: ProjectRole } = {},
): Promise<ProjectMembership> {
  const membership = await getProjectMembership(projectId, userId);

  if (!membership) {
    throw new ProjectAuthorizationError();
  }

  if (options.minimumRole) {
    const requiredPriority = ROLE_PRIORITY[options.minimumRole];
    const actualPriority = ROLE_PRIORITY[membership.role];
    if (actualPriority < requiredPriority) {
      throw new ProjectAuthorizationError();
    }
  }

  return membership;
}
