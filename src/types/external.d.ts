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
  export const expect: (actual: unknown) => unknown;
  export const test: (name: string, fn: (...args: unknown[]) => unknown) => void;
  export function defineConfig(config: unknown): unknown;
  const configExport: unknown;
  export default configExport;
}
