import type { ScriptDoc } from "@/lib/scriptDoc";
import { buildScriptDocChunks, type ScriptDocChunk } from "@/lib/retrieval/chunkScriptDoc";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import type { EntityAsset, ReferenceAsset } from "@/lib/types/assets";

// Keep the default embedding dimension in sync with the pgvector column size (1536)
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

export interface RetrievalMatch extends ScriptDocChunk {
  projectId: string;
  docId: string;
  similarity?: number;
}

interface MemoryRecord extends RetrievalMatch {
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

export interface UpsertEmbeddingsInput {
  projectId: string;
  docId: string;
  doc: ScriptDoc;
  referenceAssets: ReferenceAsset[];
  entityAssets: EntityAsset[];
}

export async function upsertScriptDocEmbeddings(input: UpsertEmbeddingsInput) {
  const chunks = buildScriptDocChunks(
    input.doc,
    input.referenceAssets,
    input.entityAssets,
  );

  if (!chunks.length) {
    return [];
  }

  const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content));

  const supabase = getSupabaseServiceClient();
  const payload = chunks.map((chunk, index) => ({
    source: chunk.source,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: vectorToSqlLiteral(embeddings[index]),
  }));

  if (supabase) {
    const { error } = await supabase.rpc("sync_scriptdoc_embeddings", {
      p_project_id: input.projectId,
      p_doc_id: input.docId,
      p_rows: payload,
    });

    if (error) {
      console.error("Failed to sync scriptdoc embeddings", error);
    }
  } else {
    const records: MemoryRecord[] = chunks.map((chunk, index) => ({
      ...chunk,
      projectId: input.projectId,
      docId: input.docId,
      embedding: embeddings[index],
    }));
    memoryIndex.set(input.projectId, records);
  }

  return chunks.length;
}

export interface RetrievalSearchInput {
  projectId: string;
  docId?: string;
  query: string;
  matchCount?: number;
}

export async function searchScriptDocEmbeddings(
  input: RetrievalSearchInput,
): Promise<RetrievalMatch[]> {
  const matchCount = input.matchCount ?? 8;
  if (!input.query.trim()) {
    return [];
  }

  const [embedding] = await createEmbeddings([input.query]);
  if (!embedding) {
    return [];
  }

  const supabase = getSupabaseServiceClient();
  if (supabase) {
    const { data, error } = await supabase.rpc(
      "match_scriptdoc_embeddings",
      {
        p_project_id: input.projectId,
        p_query_embedding: vectorToSqlLiteral(embedding),
        p_match_count: matchCount,
      },
    );

    if (error) {
      console.error("Failed to run similarity search", error);
      return [];
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      docId: String(row.doc_id),
      projectId: String(row.project_id),
      source: String(row.source),
      chunkIndex: Number(row.chunk_index),
      content: String(row.content),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      similarity: typeof row.similarity === "number" ? row.similarity : undefined,
    }));
  }

  const records = memoryIndex.get(input.projectId) ?? [];

  const scored = records
    .map((record) => {
      const { embedding: embeddingVector, ...rest } = record;
      return { ...rest, similarity: cosineSimilarity(embeddingVector, embedding) };
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, matchCount);

  return scored;
}
