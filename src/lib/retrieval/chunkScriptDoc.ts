import type { ScriptDoc } from "@/lib/scriptDoc";
import type { EntityAsset, ReferenceAsset } from "@/lib/types/assets";

export interface ScriptDocChunk {
  id: string;
  source: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export function buildScriptDocChunks(
  doc: ScriptDoc,
  references: ReferenceAsset[],
  entityAssets: EntityAsset[],
): ScriptDocChunk[] {
  const chunks: ScriptDocChunk[] = [];
  let counter = 0;

  function pushChunk(source: string, content: string, metadata: Record<string, unknown>) {
    const normalized = normalizeWhitespace(content);
    if (!normalized) {
      return;
    }
    chunks.push({
      id: `${source}:${counter}`,
      source,
      chunkIndex: counter,
      content: normalized,
      metadata,
    });
    counter += 1;
  }

  pushChunk(
    "metadata",
    `Title: ${doc.metadata.title}\nFormat: ${doc.metadata.format}\nGenre: ${doc.metadata.genre}\nLogline: ${doc.metadata.logline}\nTone: ${doc.metadata.toneKeywords.join(", ")}`,
    {
      projectId: doc.metadata.projectId,
      format: doc.metadata.format,
      tone: doc.metadata.toneKeywords,
      type: "metadata",
    },
  );

  if (doc.conceptAnalysis?.conceptSummary) {
    pushChunk(
      "concept",
      `Concept Summary: ${doc.conceptAnalysis.conceptSummary}\nAudience Promise: ${
        doc.conceptAnalysis.audiencePromise ?? ""
      }`,
      {
        keywords: doc.conceptAnalysis.keywords,
        type: "concept",
      },
    );
  }

  doc.beats.forEach((beat) => {
    pushChunk(
      `beat:${beat.id}`,
      `Beat ${beat.order} - ${beat.title}: ${beat.summary}`,
      {
        id: beat.id,
        type: "beat",
        intent: beat.intent,
        spotlightCharacterIds: beat.spotlightCharacterIds,
      },
    );
  });

  doc.scenes.forEach((scene) => {
    const elements = scene.elements
      .map((element) => {
        if (element.type === "dialogue") {
          return `${element.speaker}: ${element.text}`;
        }
        return element.text;
      })
      .join(" ");

    pushChunk(
      `scene:${scene.id}`,
      `Scene ${scene.order} (${scene.slugline.setting} ${scene.slugline.location} - ${scene.slugline.timeOfDay}): ${scene.summary}\n${elements}`,
      {
        id: scene.id,
        type: "scene",
        beatId: scene.beatId,
        characters: scene.characterIds,
      },
    );
  });

  references.forEach((asset) => {
    pushChunk(
      `reference:${asset.id}`,
      `${asset.name}: ${asset.description ?? "No description"}`,
      {
        id: asset.id,
        type: "reference-asset",
        tags: asset.tags,
        attribution: asset.attribution,
      },
    );
  });

  const assetsByEntityId = new Map<string, EntityAsset[]>();
  entityAssets.forEach((asset) => {
    const existing = assetsByEntityId.get(asset.entityId) ?? [];
    existing.push(asset);
    assetsByEntityId.set(asset.entityId, existing);
  });

  assetsByEntityId.forEach((assets, entityId) => {
    pushChunk(
      `entity-asset:${entityId}`,
      assets
        .sort((a, b) => a.order - b.order)
        .map((asset) => asset.caption ?? asset.assetId)
        .join(" | "),
      {
        entityId,
        type: "entity-asset",
        count: assets.length,
      },
    );
  });

  return chunks;
}
