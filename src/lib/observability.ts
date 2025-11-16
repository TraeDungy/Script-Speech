import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

interface SpanOptions {
  name: string;
  attributes?: Record<string, unknown>;
}

interface SpanResult {
  status: "ok" | "error";
  error?: unknown;
}

type MetricAttributes = Record<string, string | number | boolean | undefined>;

interface CounterValue {
  attributes: MetricAttributes;
  value: number;
}

interface Counter {
  name: string;
  description: string;
  values: Map<string, CounterValue>;
  startTimeUnixMs: number;
}

type TelemetryConfig = {
  serviceName: string;
  environment: string;
  traceEndpoint?: string;
  metricEndpoint?: string;
  headers: Record<string, string>;
  metricIntervalMs: number;
};

type OtelAttributeValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { doubleValue: number }
  | { intValue: number };

type OtelAttribute = {
  key: string;
  value: OtelAttributeValue;
};

const OTEL_SCOPE_NAME = "script-speech";
const MIN_METRIC_INTERVAL_MS = 2000;

const telemetryState = globalThis as typeof globalThis & {
  __scriptSpeechCounters?: Map<string, Counter>;
  __scriptSpeechSpans?: SpanRecord[];
  __scriptSpeechPendingSpans?: SpanRecord[];
  __scriptSpeechSpanFlushTimer?: ReturnType<typeof setTimeout> | null;
  __scriptSpeechMetricFlushTimer?: ReturnType<typeof setTimeout> | null;
  __scriptSpeechSentry?: Promise<SentryLike | null> | null;
  __scriptSpeechTelemetryConfig?: TelemetryConfig;
};

type SpanRecord = SpanOptions & {
  startTime: number;
  endTime?: number;
  durationMs?: number;
  result?: SpanResult;
  traceId: string;
  spanId: string;
  startEpochMs: number;
  endEpochMs?: number;
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
    counter = {
      name,
      description,
      values: new Map(),
      startTimeUnixMs: Date.now(),
    };
    counters.set(name, counter);
  }
  return counter;
}

function normalizeAttributes(attributes: MetricAttributes): MetricAttributes {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "string" ? value : value]),
  );
}

function incrementCounter(
  name: string,
  description: string,
  attributes: MetricAttributes,
  delta = 1,
): void {
  const counter = createCounter(name, description);
  const normalized = normalizeAttributes(attributes);
  const key = JSON.stringify(normalized);
  const entry = counter.values.get(key);
  if (entry) {
    entry.value += delta;
  } else {
    counter.values.set(key, { attributes: normalized, value: delta });
  }
  scheduleMetricExport();
}

export function recordApiRequest(route: string, method: string): void {
  incrementCounter("api_requests_total", "Count of API route invocations", { route, method });
}

export function recordApiError(route: string, method: string, status: number): void {
  incrementCounter("api_errors_total", "Count of API route errors", { route, method, status });
}

export function recordFlowMetric(
  name: string,
  description: string,
  attributes: MetricAttributes,
  delta = 1,
): void {
  incrementCounter(name, description, attributes, delta);
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function cloneAttributes(attributes?: Record<string, unknown>): Record<string, unknown> {
  if (!attributes) {
    return {};
  }
  return { ...attributes };
}

function startSpanInternal(name: string, attributes?: Record<string, unknown>): SpanRecord {
  if (!telemetryState.__scriptSpeechSpans) {
    telemetryState.__scriptSpeechSpans = [];
  }
  const span: SpanRecord = {
    name,
    attributes: cloneAttributes(attributes),
    startTime: performance.now(),
    startEpochMs: Date.now(),
    traceId: randomHex(16),
    spanId: randomHex(8),
  };
  telemetryState.__scriptSpeechSpans.push(span);

  if (!telemetryState.__scriptSpeechPendingSpans) {
    telemetryState.__scriptSpeechPendingSpans = [];
  }
  telemetryState.__scriptSpeechPendingSpans.push(span);
  scheduleSpanExport();
  return span;
}

function endSpan(span: SpanRecord, result: SpanResult): void {
  span.endTime = performance.now();
  span.durationMs = span.endTime - span.startTime;
  span.result = result;
  span.endEpochMs = Date.now();
}

function parseOtelHeaders(rawHeaders?: string): Record<string, string> {
  if (!rawHeaders) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const part of rawHeaders.split(",")) {
    const [key, value] = part.split("=");
    if (key && value) {
      headers[key.trim().toLowerCase()] = value.trim();
    }
  }
  return headers;
}

function getTelemetryConfig(): TelemetryConfig {
  if (!telemetryState.__scriptSpeechTelemetryConfig) {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
    telemetryState.__scriptSpeechTelemetryConfig = {
      serviceName: process.env.OTEL_SERVICE_NAME?.trim() ?? "script-speech",
      environment: process.env.NODE_ENV ?? "development",
      traceEndpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || endpoint,
      metricEndpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?.trim() || endpoint,
      headers: parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      metricIntervalMs: Math.max(
        Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS) || 15000,
        MIN_METRIC_INTERVAL_MS,
      ),
    };
  }
  return telemetryState.__scriptSpeechTelemetryConfig;
}

function buildResourceAttributes(config: TelemetryConfig): OtelAttribute[] {
  return [
    { key: "service.name", value: { stringValue: config.serviceName } },
    { key: "deployment.environment", value: { stringValue: config.environment } },
  ];
}

function convertAttributes(attributes?: Record<string, unknown>): OtelAttribute[] {
  if (!attributes) {
    return [];
  }
  const otelAttributes: OtelAttribute[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string") {
      otelAttributes.push({ key, value: { stringValue: value } });
    } else if (typeof value === "boolean") {
      otelAttributes.push({ key, value: { boolValue: value } });
    } else if (Number.isInteger(value)) {
      otelAttributes.push({ key, value: { intValue: Number(value) } });
    } else if (typeof value === "number") {
      otelAttributes.push({ key, value: { doubleValue: value } });
    } else {
      otelAttributes.push({ key, value: { stringValue: JSON.stringify(value) } });
    }
  }
  return otelAttributes;
}

function toUnixNano(epochMs: number): string {
  return BigInt(Math.round(epochMs * 1e6)).toString();
}

function scheduleSpanExport(): void {
  const config = getTelemetryConfig();
  if (!config.traceEndpoint) {
    return;
  }
  if (telemetryState.__scriptSpeechSpanFlushTimer) {
    return;
  }
  telemetryState.__scriptSpeechSpanFlushTimer = setTimeout(() => {
    telemetryState.__scriptSpeechSpanFlushTimer = null;
    void exportQueuedSpans();
  }, 1000);
}

async function exportQueuedSpans(): Promise<void> {
  const config = getTelemetryConfig();
  if (!config.traceEndpoint) {
    return;
  }
  const pending = telemetryState.__scriptSpeechPendingSpans;
  if (!pending || pending.length === 0) {
    return;
  }
  const spans = pending.splice(0, pending.length);
  const payload = {
    resourceSpans: [
      {
        resource: { attributes: buildResourceAttributes(config) },
        scopeSpans: [
          {
            scope: { name: OTEL_SCOPE_NAME },
            spans: spans.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
              name: span.name,
              startTimeUnixNano: toUnixNano(span.startEpochMs),
              endTimeUnixNano: toUnixNano(span.endEpochMs ?? Date.now()),
              attributes: convertAttributes(span.attributes),
              status:
                span.result?.status === "error"
                  ? {
                      code: 2,
                      message:
                        span.result?.error instanceof Error
                          ? span.result.error.message
                          : span.result?.error
                            ? String(span.result.error)
                            : "",
                    }
                  : { code: 1 },
            })),
          },
        ],
      },
    ],
  } satisfies Record<string, unknown>;

  await sendOtelPayload(config.traceEndpoint, payload, config, "traces");
}

function scheduleMetricExport(): void {
  const config = getTelemetryConfig();
  if (!config.metricEndpoint) {
    return;
  }
  if (telemetryState.__scriptSpeechMetricFlushTimer) {
    return;
  }
  telemetryState.__scriptSpeechMetricFlushTimer = setTimeout(() => {
    telemetryState.__scriptSpeechMetricFlushTimer = null;
    void exportMetrics();
  }, config.metricIntervalMs);
}

async function exportMetrics(): Promise<void> {
  const config = getTelemetryConfig();
  if (!config.metricEndpoint) {
    return;
  }
  const counters = Array.from(getCounters().values());
  if (!counters.length) {
    return;
  }
  const now = Date.now();
  const metrics = counters
    .map((counter) => {
      const dataPoints = Array.from(counter.values.values()).map((value) => ({
        attributes: convertAttributes(value.attributes),
        startTimeUnixNano: toUnixNano(counter.startTimeUnixMs),
        timeUnixNano: toUnixNano(now),
        asDouble: value.value,
      }));
      if (!dataPoints.length) {
        return null;
      }
      return {
        name: counter.name,
        description: counter.description,
        sum: {
          aggregationTemporality: 2,
          isMonotonic: true,
          dataPoints,
        },
      };
    })
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  if (!metrics.length) {
    return;
  }

  const payload = {
    resourceMetrics: [
      {
        resource: { attributes: buildResourceAttributes(config) },
        scopeMetrics: [
          {
            scope: { name: OTEL_SCOPE_NAME },
            metrics,
          },
        ],
      },
    ],
  } satisfies Record<string, unknown>;

  await sendOtelPayload(config.metricEndpoint, payload, config, "metrics");
}

async function sendOtelPayload(
  endpoint: string,
  payload: Record<string, unknown>,
  config: TelemetryConfig,
  channel: string,
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logStructuredEvent({
      level: "warn",
      message: `otel.${channel}.export.failed`,
      error,
      context: { endpoint },
    });
  }
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
