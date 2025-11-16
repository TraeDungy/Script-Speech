import { describe, expect, it } from "vitest";

import {
  evaluatePromptGuardrails,
  evaluateSyntheticProjects,
} from "@/lib/orchestrator/guardrails";
import { syntheticProjects } from "../../fixtures/syntheticProjects";

describe("guardrail evaluation", () => {
  it("flags unsafe prompts", () => {
    const unsafe = syntheticProjects.find((spec) => spec.id === "unsafe-project");
    expect(unsafe).toBeTruthy();
    const result = evaluatePromptGuardrails(unsafe!);
    expect(result.allowed).toBe(false);
    expect(result.violations).not.toHaveLength(0);
  });

  it("approves safe prompts", () => {
    const safe = syntheticProjects.find((spec) => spec.id === "safe-project");
    expect(safe).toBeTruthy();
    const result = evaluatePromptGuardrails(safe!);
    expect(result.allowed).toBe(true);
  });

  it("runs synthetic suite", () => {
    const results = evaluateSyntheticProjects(syntheticProjects);
    const map = Object.fromEntries(results.map((entry) => [entry.id, entry.result.allowed]));
    expect(map["safe-project"]).toBe(true);
    expect(map["unsafe-project"]).toBe(false);
  });
});
