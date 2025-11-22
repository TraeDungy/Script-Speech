export interface Span {
  setAttribute(key: string, value: unknown): void;
}

export function recordApiRequest(route: string, method: string): void;
export function recordApiError(route: string, method: string, status: number): void;
export function captureApiException(
  error: unknown,
  context: { route: string; method: string; status?: number },
): Promise<void>;
export function logStructuredEvent(event: {
  level?: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}): void;
export function recordBusinessEvent(
  name: string,
  description: string,
  attributes: Record<string, string | number | boolean | undefined>,
): void;
export function withSpan<T>(
  options: { name: string; attributes?: Record<string, unknown> },
  run: (span: Span) => Promise<T>,
): Promise<T>;
