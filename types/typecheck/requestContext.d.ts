export const REQUEST_ID_HEADER: string;
export function getRequestIdFromHeaders(headers: Headers): string | undefined;
export function createRequestLogger(requestId?: string): (event: {
  level?: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}) => void;
