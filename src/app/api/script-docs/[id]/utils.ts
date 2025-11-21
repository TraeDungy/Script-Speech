import type { Database } from "@/lib/db/generated.types";
import { getSupabaseServiceClient } from "@/lib/supabase.server";

export const docSelect = "id, doc, metadata, updated_at, user_id, record_type";

type ScriptDocRow = Database["public"]["Tables"]["script_docs"]["Row"];

export async function loadScriptDoc(id: string, userId: string): Promise<ScriptDocRow | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("script_docs")
    .select(docSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data ?? null;
}
