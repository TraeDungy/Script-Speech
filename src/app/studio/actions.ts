"use server";

import { getStudioHydration } from "@/lib/db/projects";
import { listEntityAssets, listReferenceAssets } from "@/lib/assets";

export async function fetchStudioProjectData(projectId: string) {
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
