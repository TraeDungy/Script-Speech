declare module "@sentry/node" {
  export type CaptureContext = {
    tags?: Record<string, string | undefined>;
    extra?: Record<string, unknown>;
  };

  export function init(options: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
  }): void;

  export function captureException(error: unknown, context?: CaptureContext): unknown;
}
declare module "@playwright/test" {
  export const expect: any;
  export const test: any;
  export function defineConfig(config: unknown): unknown;
  const configExport: any;
  export default configExport;
}
