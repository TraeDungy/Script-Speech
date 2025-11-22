import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
import type { ScriptDoc } from "@/lib/scriptDoc";
import {
  searchScriptDocEmbeddings,
  upsertScriptDocEmbeddings,
  type RetrievalMatch,
} from "@/lib/retrieval/referenceRetrieval.server";
import {
  searchReferenceAssetEmbeddings,
  upsertReferenceAssetEmbeddings,
  type ReferenceAssetMatch,
} from "@/lib/retrieval/referenceAssetsVector.server";

export interface RetrievalContextResult {
  scriptDoc: RetrievalMatch[];
  references: ReferenceAssetMatch[];
}

export interface RetrievalContextInput {
  projectId: string;
  docId: string;
  prompt: string;
  doc: ScriptDoc;
}

export class OrchestrationRetrievalService {
  async loadProjectAssets(projectId: string) {
    const [referenceAssets, entityAssets] = await Promise.all([
      listReferenceAssets(projectId),
      listEntityAssets(projectId),
    ]);

    return { referenceAssets, entityAssets };
  }

  async syncAndSearch(
    input: RetrievalContextInput,
    assets: Awaited<ReturnType<OrchestrationRetrievalService["loadProjectAssets"]>>,
  ): Promise<RetrievalContextResult> {
    await Promise.all([
      upsertScriptDocEmbeddings({
        projectId: input.projectId,
        docId: input.docId,
        doc: input.doc,
        referenceAssets: assets.referenceAssets,
        entityAssets: assets.entityAssets,
      }).catch((error) => {
        console.error("Failed to sync ScriptDoc embeddings", error);
      }),
      upsertReferenceAssetEmbeddings({ projectId: input.projectId, assets: assets.referenceAssets }).catch((error) => {
        console.error("Failed to sync reference asset embeddings", error);
      }),
    ]);

    const [scriptDoc, references] = await Promise.all([
      searchScriptDocEmbeddings({
        projectId: input.projectId,
        docId: input.docId,
        query: input.prompt,
        matchCount: 8,
      }).catch((error) => {
        console.error("Failed to search ScriptDoc embeddings", error);
        return [] as RetrievalMatch[];
      }),
      searchReferenceAssetEmbeddings({
        projectId: input.projectId,
        query: input.prompt,
        matchCount: 6,
      }).catch((error) => {
        console.error("Failed to search reference asset embeddings", error);
        return [] as ReferenceAssetMatch[];
      }),
    ]);

    return { scriptDoc, references };
  }
}

let cachedService: OrchestrationRetrievalService | null = null;

export function getOrchestrationRetrievalService(): OrchestrationRetrievalService {
  if (!cachedService) {
    cachedService = new OrchestrationRetrievalService();
  }
  return cachedService;
}
