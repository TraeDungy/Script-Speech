# Observability and OpenTelemetry

The Script Speech API emits structured logs, metrics, and traces for the access-request, onboarding, and export flows. Metrics and spans are buffered in-memory and pushed to any OTLP collector that you configure through environment variables. This allows the data to land in Grafana Cloud, Datadog, or any other OpenTelemetry-compatible dashboard.

## Environment variables

| Variable | Description |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base OTLP HTTP endpoint (used when the signal-specific endpoints below are not set). |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Optional trace-specific OTLP endpoint. |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Optional metrics-specific OTLP endpoint. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Comma-separated list of `key=value` pairs appended to OTLP requests (useful for Grafana Cloud tokens or Datadog API keys). |
| `OTEL_SERVICE_NAME` | Overrides the `service.name` resource attribute (defaults to `script-speech`). |
| `OTEL_METRIC_EXPORT_INTERVAL_MS` | Controls how often metrics are flushed (defaults to 15 seconds, minimum 2 seconds). |

### Grafana Cloud

1. Create an OTLP access policy key in Grafana Cloud.
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp`.
3. Set `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance-id:api-key>`.
4. Deploy — spans and metrics will appear under the configured service name.

### Datadog

1. Use the Datadog OTLP ingestion endpoint, e.g. `https://api.datadoghq.com/api/v2/otlp`.
2. Set `OTEL_EXPORTER_OTLP_HEADERS=DD-API-KEY=<your-key>`.
3. Optionally set `OTEL_SERVICE_NAME` to match your Datadog service taxonomy.

## Emitted signals

* `access_requests_total` – counts access-request outcomes (`result` attribute is one of `accepted`, `rate_limited`, or `error`).
* `access_request_reads_total` – tracks admin reads of stored access requests.
* `onboarding_events_total` – emits when projects are created via the onboarding flow.
* `export_jobs_total` – tracks export job state transitions (`stage` attribute is `queued`, `processing`, `completed`, or `failed`).
* Trace spans are emitted for API handlers (`api.*`) and service-level work (`access-requests.*`, `onboarding.*`, `exports.*`). Each span carries useful attributes like project IDs, job formats, or metadata counts.

Grafana/Datadog dashboards can now alert on these signals and visualize per-format completion times or rate-limit hits without any additional instrumentation.
