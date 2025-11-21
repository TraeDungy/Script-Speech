import { randomUUID } from "node:crypto";

import { createStructuredLogger } from "@/lib/observability";

export const REQUEST_ID_HEADER = "x-request-id";

export function getRequestIdFromHeaders(headers: Headers): string | undefined {
  const value = headers.get(REQUEST_ID_HEADER);
  return value ?? undefined;
}

export function ensureRequestIdHeaders(headers: Headers): {
  requestId: string;
  headers: Headers;
} {
  const existing = getRequestIdFromHeaders(headers);
  const requestId = existing ?? randomUUID();
  const nextHeaders = new Headers(headers);
  nextHeaders.set(REQUEST_ID_HEADER, requestId);
  return { requestId, headers: nextHeaders };
}

export function createRequestLogger(requestId?: string) {
  return createStructuredLogger(requestId ? { requestId } : undefined);
}
