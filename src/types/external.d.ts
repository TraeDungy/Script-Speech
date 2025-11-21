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
  import type { defineConfig as playwrightDefineConfig, expect as playwrightExpect, test as playwrightTest } from "@playwright/test";

  export const expect: typeof playwrightExpect;
  export const test: typeof playwrightTest;
  export function defineConfig(
    ...args: Parameters<typeof playwrightDefineConfig>
  ): ReturnType<typeof playwrightDefineConfig>;
  const configExport: ReturnType<typeof playwrightDefineConfig>;
  export default configExport;
}
