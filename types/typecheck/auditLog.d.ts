export async function logAuditEvent(event: {
  action: string;
  userId: string;
  projectId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  severity?: string;
}): Promise<void>
