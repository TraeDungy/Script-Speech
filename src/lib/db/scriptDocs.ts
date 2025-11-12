import type { ScriptDoc } from "@/lib/scriptDoc";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { getMockScriptDoc, getMockScriptDocRow } from "./mocks";
import type { ScriptDocRow } from "./schema";

function mapScriptDocRow(row: ScriptDocRow): ScriptDoc {
  return row.doc;
}

export async function fetchLatestScriptDoc(projectId: string): Promise<ScriptDoc | null> {
  if (!isSupabaseConfigured()) {
    const mockRow = getMockScriptDocRow();
    return mockRow.project_id === projectId ? mapScriptDocRow(mockRow) : getMockScriptDoc();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ScriptDocRow>("script_docs")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to fetch script doc", error);
    throw error;
  }

  return data ? mapScriptDocRow(data) : null;
}

export async function upsertScriptDoc(
  projectId: string,
  doc: ScriptDoc,
): Promise<ScriptDoc> {
  if (!isSupabaseConfigured()) {
    return getMockScriptDoc();
  }

  const supabase = getSupabaseClient();
  const payload: Partial<ScriptDocRow> & { project_id: string } = {
    project_id: projectId,
    doc,
    revision_id: doc.revision?.id ?? null,
  };

  const { data, error } = await supabase
    .from<ScriptDocRow>("script_docs")
    .upsert(payload, { onConflict: "project_id" })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to upsert script doc", error);
    throw error;
  }

  return mapScriptDocRow(data);
}
