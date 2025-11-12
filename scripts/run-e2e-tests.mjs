#!/usr/bin/env node
import { spawn } from "node:child_process";

async function run() {
  let playwrightAvailable = true;
  try {
    await import("@playwright/test");
  } catch (error) {
    playwrightAvailable = false;
    console.warn(
      "[e2e] Playwright is not installed. Skipping browser end-to-end tests. Install '@playwright/test' to enable them.",
    );
  }

  if (!playwrightAvailable) {
    process.exit(0);
    return;
  }

  const child = spawn("npx", ["playwright", "test"], {
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("close", (code) => {
    process.exit(code ?? 1);
  });
}

run().catch((error) => {
  console.error("Failed to run Playwright tests", error);
  process.exit(1);
});
