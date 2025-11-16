import type { ScriptDoc } from "@/lib/exports/types";

import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { createMockDraftVersion } from "./mocks";
import type { DraftVersionRow } from "./schema";

export interface DraftVersionInput {
  projectId: string;
  doc: ScriptDoc;
  summary?: string | null;
  createdBy?: string | null;
}

export async function createDraftVersionRecord(input: DraftVersionInput): Promise<DraftVersionRow> {
  if (!isSupabaseConfigured()) {
    return createMockDraftVersion({
      projectId: input.projectId,
      doc: input.doc,
      summary: input.summary,
      createdBy: input.createdBy,
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<DraftVersionRow>("draft_versions")
    .insert({
      project_id: input.projectId,
      doc: input.doc,
      summary: input.summary ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create draft version", error);
    throw error ?? new Error("Unable to persist draft version");
  }

  return data;
}
