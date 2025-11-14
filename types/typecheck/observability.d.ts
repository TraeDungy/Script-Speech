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
  level?: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}): void;
export function withSpan<T>(
  options: { name: string; attributes?: Record<string, unknown> },
  run: (span: Span) => Promise<T>,
): Promise<T>;
