"use server";

import { getStudioHydration } from "@/lib/db/projects";
import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
import { requireServerAuthSession } from "@/lib/auth/server";
import { ensureProjectMembership } from "@/lib/authz/projects.server";

export async function fetchStudioProjectData(projectId: string) {
  const { user } = await requireServerAuthSession();
  await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

  const [hydration, references, entityAssets] = await Promise.all([
    getStudioHydration(projectId),
    listReferenceAssets(projectId),
    listEntityAssets(projectId),
  ]);

  return {
    ...hydration,
    assets: {
      references,
      entityAssets,
    },
  };
}
