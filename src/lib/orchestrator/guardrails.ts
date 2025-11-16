import type { ScriptDoc } from "@/lib/scriptDoc";

export interface GuardrailViolation {
  code: string;
  message: string;
  snippet?: string;
}

export interface GuardrailEvaluationResult {
  allowed: boolean;
  violations: GuardrailViolation[];
}

const PROHIBITED_PATTERNS: Array<{ code: string; regex: RegExp; message: string }> = [
  {
    code: "safety.explosive",
    regex: /(make|build).{0,20}(bomb|explosive)/i,
    message: "Requests for explosive construction are not permitted.",
  },
  {
    code: "safety.hate",
    regex: /(eliminate|eradicate).{0,20}(group|people|audience)/i,
    message: "Violent or hateful directives are blocked by policy.",
  },
  {
    code: "safety.self-harm",
    regex: /(self-harm|suicide|kill myself)/i,
    message: "Self-harm instructions are disallowed.",
  },
];

const AGGRESSIVE_TONE = /!{2,}|\b(now|immediately|or else)\b/i;

export interface GuardrailInput {
  prompt: string;
  doc?: ScriptDoc | null;
}

function normalizePrompt(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function evaluatePromptGuardrails(input: GuardrailInput): GuardrailEvaluationResult {
  const normalized = normalizePrompt(input.prompt);
  const violations: GuardrailViolation[] = [];

  PROHIBITED_PATTERNS.forEach((rule) => {
    const match = normalized.match(rule.regex);
    if (match) {
      violations.push({ code: rule.code, message: rule.message, snippet: match[0] });
    }
  });

  if (AGGRESSIVE_TONE.test(normalized)) {
    violations.push({
      code: "tone.aggressive",
      message: "Prompts must maintain professional tone without aggressive demands.",
    });
  }

  if (input.doc?.metadata.rating === "G" || input.doc?.metadata.rating === "PG") {
    const violentLanguage = /(murder|blood|torture|kill)/i;
    if (violentLanguage.test(normalized)) {
      violations.push({
        code: "tone.rating-mismatch",
        message: "Violent direction conflicts with the project's rating.",
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}

export interface SyntheticProjectSpec {
  id: string;
  prompt: string;
  doc: ScriptDoc;
}

export function evaluateSyntheticProjects(
  specs: SyntheticProjectSpec[],
): Array<{ id: string; result: GuardrailEvaluationResult }> {
  return specs.map((spec) => ({ id: spec.id, result: evaluatePromptGuardrails(spec) }));
}

export function enforceGuardrails(specs: SyntheticProjectSpec[]): void {
  const results = evaluateSyntheticProjects(specs);
  const failures = results.filter((entry) => entry.result.allowed === false);
  if (failures.length) {
    throw new Error(
      `Guardrail evaluation failed for synthetic specs: ${failures
        .map((entry) => `${entry.id}:${entry.result.violations.map((v) => v.code).join(",")}`)
        .join(";")}`,
    );
  }
}
