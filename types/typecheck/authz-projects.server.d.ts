export class ProjectAuthorizationError extends Error {}

export async function ensureProjectMembership(
  projectId: string,
  userId: string,
  options?: { minimumRole?: string },
): Promise<void>
