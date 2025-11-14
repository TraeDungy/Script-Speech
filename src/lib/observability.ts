import { performance } from "node:perf_hooks";

interface SpanOptions {
  name: string;
  attributes?: Record<string, unknown>;
}

interface SpanResult {
  status: "ok" | "error";
  error?: unknown;
}

interface ApiMetricAttributes {
  route: string;
  method: string;
  status?: number;
}

interface Counter {
  name: string;
  description: string;
  values: Map<string, number>;
}

const telemetryState = globalThis as typeof globalThis & {
  __scriptSpeechCounters?: Map<string, Counter>;
  __scriptSpeechSpans?: SpanRecord[];
  __scriptSpeechSentry?: Promise<SentryLike | null> | null;
};

type SpanRecord = SpanOptions & {
  startTime: number;
  endTime?: number;
  durationMs?: number;
  result?: SpanResult;
};

type StructuredLogLevel = "debug" | "info" | "warn" | "error";

type StructuredLogEvent = {
  level?: StructuredLogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
};

type SentryLike = {
  init?(options: { dsn?: string; environment?: string; tracesSampleRate?: number }): void;
  captureException(error: unknown, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): unknown;
};

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Error", message: typeof error === "string" ? error : JSON.stringify(error) };
}

export function logStructuredEvent(event: StructuredLogEvent): void {
  const level: StructuredLogLevel = event.level ?? "info";
  const payload = {
    ...event.context,
    timestamp: new Date().toISOString(),
    level,
    message: event.message,
    ...(event.error ? { error: serializeError(event.error) } : {}),
  } satisfies Record<string, unknown>;

  const method =
    level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.info;
  method("[observability]", payload);
}

function getCounters(): Map<string, Counter> {
  if (!telemetryState.__scriptSpeechCounters) {
    telemetryState.__scriptSpeechCounters = new Map();
  }
  return telemetryState.__scriptSpeechCounters;
}

function createCounter(name: string, description: string): Counter {
  const counters = getCounters();
  let counter = counters.get(name);
  if (!counter) {
    counter = { name, description, values: new Map() };
    counters.set(name, counter);
  }
  return counter;
}

function formatAttributes(attributes: ApiMetricAttributes): string {
  const entries = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
  return entries;
}

function incrementCounter(name: string, description: string, attributes: ApiMetricAttributes) {
  const counter = createCounter(name, description);
  const key = formatAttributes(attributes);
  const current = counter.values.get(key) ?? 0;
  counter.values.set(key, current + 1);
}

export function recordApiRequest(route: string, method: string): void {
  incrementCounter("api_requests_total", "Count of API route invocations", { route, method });
}

export function recordApiError(route: string, method: string, status: number): void {
  incrementCounter("api_errors_total", "Count of API route errors", { route, method, status });
}

function startSpanInternal(name: string, attributes?: Record<string, unknown>): SpanRecord {
  if (!telemetryState.__scriptSpeechSpans) {
    telemetryState.__scriptSpeechSpans = [];
  }
  const span: SpanRecord = {
    name,
    attributes,
    startTime: performance.now(),
  };
  telemetryState.__scriptSpeechSpans.push(span);
  return span;
}

function endSpan(span: SpanRecord, result: SpanResult): void {
  span.endTime = performance.now();
  span.durationMs = span.endTime - span.startTime;
  span.result = result;
}

async function loadSentry(): Promise<SentryLike | null> {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  if (!telemetryState.__scriptSpeechSentry) {
    const moduleId = "@sentry/node";
    telemetryState.__scriptSpeechSentry = import(moduleId)
      .then((mod) => {
        if (typeof mod.init === "function") {
          mod.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV ?? "development",
            tracesSampleRate: 0.1,
          });
        }
        return mod as SentryLike;
      })
      .catch((error) => {
        console.warn("[observability] Unable to load Sentry client", error);
        return null;
      });
  }

  return telemetryState.__scriptSpeechSentry;
}

async function captureWithSentry(
  error: unknown,
  context: { tags?: Record<string, string>; extra?: Record<string, unknown>; fallbackMessage: string },
): Promise<void> {
  const sentry = await loadSentry();
  if (sentry && typeof sentry.captureException === "function") {
    sentry.captureException(error, { tags: context.tags, extra: context.extra });
    return;
  }

  logStructuredEvent({ level: "error", message: context.fallbackMessage, error, context: context.extra });
}

export async function captureApiException(
  error: unknown,
  context: { route: string; method: string; status?: number },
): Promise<void> {
  const tags: Record<string, string> = {
    route: context.route,
    method: context.method,
  };
  if (context.status !== undefined) {
    tags.status = String(context.status);
  }

  await captureWithSentry(error, {
    tags,
    extra: { status: context.status },
    fallbackMessage: `${context.method} ${context.route} failed`,
  });
}

export async function captureServiceException(
  error: unknown,
  context: { service: string; operation: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await captureWithSentry(error, {
    tags: { service: context.service, operation: context.operation },
    extra: context.metadata,
    fallbackMessage: `${context.service}.${context.operation} failed`,
  });
}

export async function withSpan<T>(
  options: SpanOptions,
  run: (span: { setAttribute: (key: string, value: unknown) => void }) => Promise<T>,
): Promise<T> {
  const span = startSpanInternal(options.name, options.attributes);
  const activeAttributes = span.attributes ?? {};
  const apiSpan = {
    setAttribute(key: string, value: unknown) {
      activeAttributes[key] = value;
    },
  };

  try {
    const result = await run(apiSpan);
    endSpan(span, { status: "ok" });
    return result;
  } catch (error) {
    endSpan(span, { status: "error", error });
    throw error;
  }
}

export function getCollectedCounters(): Counter[] {
  return Array.from(getCounters().values());
}

export function getCollectedSpans(): SpanRecord[] {
  return telemetryState.__scriptSpeechSpans ?? [];
}
