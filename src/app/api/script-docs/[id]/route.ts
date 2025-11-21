import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import type { Database } from "@/lib/db/generated.types";
import { getSupabaseServiceClient } from "@/lib/supabase.server";

const docSelect = "id, doc, metadata, updated_at, user_id, record_type";

type ScriptDocRow = Database["public"]["Tables"]["script_docs"]["Row"];

type AutosavePayload = {
  doc?: unknown;
  cursorState?: unknown;
  updatedAt?: string;
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: AutosavePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.doc) {
    return NextResponse.json({ error: "Missing doc payload" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
    }

    const existing = await loadScriptDoc(params.id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    if (body.updatedAt && new Date(existing.updated_at).getTime() > new Date(body.updatedAt).getTime()) {
      return NextResponse.json(
        { error: "conflict", scriptDoc: existing.doc, updatedAt: existing.updated_at },
        { status: 409 },
      );
    }

    const metadata = {
      ...(existing.metadata as Record<string, unknown>),
      cursorState: body.cursorState ?? (existing.metadata as Record<string, unknown> | null)?.cursorState,
    };

    const { data, error } = await supabase
      .from("script_docs")
      .update({
        doc: body.doc,
        metadata,
        updated_at: new Date().toISOString(),
        record_type: existing.record_type ?? "autosave",
        user_id: existing.user_id ?? user.id,
      })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(docSelect)
      .maybeSingle();

    if (error) {
      console.error("Failed to persist autosave", error);
      return NextResponse.json({ error: "Unable to save ScriptDoc" }, { status: 500 });
    }

    return NextResponse.json({ scriptDoc: data?.doc, updatedAt: data?.updated_at });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Autosave failed", error);
    return NextResponse.json({ error: "Unable to save ScriptDoc" }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireServerAuthSession();
    const record = await loadScriptDoc(params.id, user.id);

    if (!record) {
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    return NextResponse.json({
      scriptDoc: record.doc,
      updatedAt: record.updated_at,
      recordType: record.record_type,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to load ScriptDoc", error);
    return NextResponse.json({ error: "Unable to load ScriptDoc" }, { status: 500 });
  }
}

async function loadScriptDoc(id: string, userId: string): Promise<ScriptDocRow | null> {
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
