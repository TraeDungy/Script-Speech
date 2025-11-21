import { getSupabaseServiceClient } from "@/lib/supabase.server";
import type { ReferenceAsset } from "@/lib/types/assets";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

export interface ReferenceAssetMatch {
  projectId: string;
  assetId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

interface MemoryRecord extends ReferenceAssetMatch {
  embedding: number[];
}

const memoryIndex = new Map<string, MemoryRecord[]>();

async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to create embeddings: ${payload}`);
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data.map((item) => item.embedding);
}

function vectorToSqlLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(6)).join(",")}]`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

function buildAssetEmbeddingText(asset: ReferenceAsset): string {
  const tags = asset.tags?.join(", ") ?? "";
  const beatTags = asset.beatTags?.join(", ") ?? "";
  const sceneTags = asset.sceneTags?.join(", ") ?? "";
  const description = asset.description ?? "";
  const attribution = asset.attribution ?? "";
  return [
    `Name: ${asset.name}`,
    description && `Description: ${description}`,
    tags && `Tags: ${tags}`,
    beatTags && `Beat tags: ${beatTags}`,
    sceneTags && `Scene tags: ${sceneTags}`,
    attribution && `Attribution: ${attribution}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface UpsertReferenceAssetEmbeddingsInput {
  projectId: string;
  assets: ReferenceAsset[];
}

export async function upsertReferenceAssetEmbeddings({ projectId, assets }: UpsertReferenceAssetEmbeddingsInput) {
  if (!assets.length) return 0;

  const rows = assets.map((asset) => ({
    assetId: asset.id,
    content: buildAssetEmbeddingText(asset),
    metadata: {
      contentType: asset.contentType,
      size: asset.size,
      tags: asset.tags,
      beatTags: asset.beatTags,
      sceneTags: asset.sceneTags,
    },
  }));

  const embeddings = await createEmbeddings(rows.map((row) => row.content));
  const supabase = getSupabaseServiceClient();

  if (supabase) {
    for (const [index, row] of rows.entries()) {
      const { error } = await supabase.rpc("sync_reference_asset_embeddings", {
        p_project_id: projectId,
        p_asset_id: row.assetId,
        p_rows: [
          {
            chunk_index: 0,
            content: row.content,
            metadata: row.metadata,
            embedding: vectorToSqlLiteral(embeddings[index]),
          },
        ],
      });

      if (error) {
        console.error("Failed to sync reference asset embedding", error);
      }
    }
  } else {
    const records: MemoryRecord[] = rows.map((row, index) => ({
      projectId,
      assetId: row.assetId,
      content: row.content,
      metadata: row.metadata,
      similarity: undefined,
      embedding: embeddings[index],
    }));
    memoryIndex.set(projectId, records);
  }

  return rows.length;
}

export interface SearchReferenceAssetEmbeddingsInput {
  projectId: string;
  query: string;
  matchCount?: number;
}

export async function searchReferenceAssetEmbeddings(
  input: SearchReferenceAssetEmbeddingsInput,
): Promise<ReferenceAssetMatch[]> {
  const matchCount = input.matchCount ?? 6;
  if (!input.query.trim()) {
    return [];
  }

  const [embedding] = await createEmbeddings([input.query]);
  if (!embedding) {
    return [];
  }

  const supabase = getSupabaseServiceClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("match_reference_asset_embeddings", {
      p_project_id: input.projectId,
      p_query_embedding: vectorToSqlLiteral(embedding),
      p_match_count: matchCount,
    });

    if (error) {
      console.error("Failed to run reference asset similarity search", error);
      return [];
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      projectId: String(row.project_id),
      assetId: String(row.asset_id),
      content: String(row.content),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      similarity: typeof row.similarity === "number" ? row.similarity : undefined,
    }));
  }

  const records = memoryIndex.get(input.projectId) ?? [];
  const scored = records
    .map((record) => ({
      ...record,
      similarity: cosineSimilarity(record.embedding, embedding),
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, matchCount)
    .map((record) => {
      const rest = { ...record };
      delete (rest as { embedding?: unknown }).embedding;
      return rest;
    });

  return scored;
}
