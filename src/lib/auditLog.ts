import { getSupabaseServiceClient } from "@/lib/supabase.server";

export interface AuditLogEvent {
  action: string;
  userId: string;
  projectId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  severity?: "info" | "high";
}

export async function logAuditEvent(event: AuditLogEvent): Promise<void> {
  const payload = {
    action: event.action,
    user_id: event.userId,
    project_id: event.projectId ?? null,
    target_id: event.targetId ?? null,
    severity: event.severity ?? "info",
    details: event.details ? JSON.stringify(event.details) : null,
  };

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.info("[audit]", JSON.stringify(payload));
    return;
  }

  try {
    const { error } = await supabase.from("audit_logs").insert(payload);
    if (error) {
      console.warn("Failed to persist audit log", error);
    }
  } catch (error) {
    console.warn("Audit logging error", error);
  }
}
