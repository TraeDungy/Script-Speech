export class AccessRequestError extends Error {
  constructor(message: string, statusCode?: number);
  statusCode: number;
}

export interface AccessRequestRecord {
  id: string;
  email: string;
  message?: string;
  metadata?: Record<string, unknown>;
  client?: Record<string, unknown>;
  submittedAt: string;
}

export function listAccessRequests(): Promise<AccessRequestRecord[]>;
export function createAccessRequest(input: Record<string, unknown>): Promise<AccessRequestRecord>;
