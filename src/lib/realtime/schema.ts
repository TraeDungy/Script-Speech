import type { ScriptDoc } from "../scriptDoc";

export type JSONSchema =
  | { type: "string" | "number" | "integer" | "boolean" | "null" }
  | { type: "array"; items: JSONSchema; minItems?: number; maxItems?: number }
  | {
      type: "object";
      properties?: Record<string, JSONSchema>;
      required?: string[];
      additionalProperties?: boolean;
    }
  | { anyOf: JSONSchema[] }
  | { enum: unknown[] };

export interface ToolSchemaDefinition {
  name: string;
  description?: string;
  schema: JSONSchema;
}

export interface TranscriptTurnDTO {
  id: string;
  role: string;
  text: string;
  final: boolean;
  createdAt: string;
  sessionId?: string;
  projectId?: string;
}

export interface ToolInvocationMessage {
  callId: string;
  name: string;
  arguments: unknown;
  createdAt?: string;
  sessionId?: string;
  projectId?: string;
}

export interface ToolAcknowledgement {
  requestId: string;
  status: "accepted" | "rejected";
  timestamp: string;
  reason?: string;
  projectStatePatch?: Partial<ScriptDoc>;
  transcriptTurn?: TranscriptTurnDTO;
}

export interface OrchestratorSessionMetadata {
  sessionId: string;
  ackToken: string;
  projectId?: string;
  expiresAt?: string;
  toolSchemas: ToolSchemaDefinition[];
  transcripts?: TranscriptTurnDTO[];
  projectStatePatch?: Partial<ScriptDoc>;
  projectStatePatchReason?: string;
}

export const TOOL_DEFINITIONS: ToolSchemaDefinition[] = [
  {
    name: "update_project_state",
    description: "Apply a partial update to the ScriptDoc store for the active project.",
    schema: {
      type: "object",
      properties: {
        patch: { type: "object", additionalProperties: true },
        reason: { type: "string" },
      },
      required: ["patch"],
      additionalProperties: false,
    },
  },
  {
    name: "log_transcript_turn",
    description: "Persist a transcript turn to Supabase for replay and analysis.",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        role: { type: "string" },
        text: { type: "string" },
        final: { type: "boolean" },
        createdAt: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["id", "role", "text", "final", "createdAt"],
      additionalProperties: false,
    },
  },
];

export const TOOL_DEFINITION_MAP = new Map<string, ToolSchemaDefinition>(
  TOOL_DEFINITIONS.map((definition) => [definition.name, definition]),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function validateAgainstSchema(schema: JSONSchema, value: unknown, path: string): string[] {
  if ("anyOf" in schema && schema.anyOf) {
    const errors = schema.anyOf
      .map((child) => validateAgainstSchema(child, value, path))
      .filter((childErrors) => childErrors.length === 0);
    if (errors.length > 0) {
      return [];
    }
    return [
      `${path} did not match any allowed schema`,
    ];
  }

  if ("enum" in schema && schema.enum) {
    if (!schema.enum.some((entry) => Object.is(entry, value))) {
      return [`${path} must be one of: ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}`];
    }
    return [];
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return [`${path} must be an array`];
    }
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      return [`${path} must contain at least ${schema.minItems} items`];
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      return [`${path} must contain no more than ${schema.maxItems} items`];
    }
    return value.flatMap((entry, index) => validateAgainstSchema(schema.items, entry, `${path}[${index}]`));
  }

  if (schema.type === "object") {
    if (!isPlainObject(value)) {
      return [`${path} must be an object`];
    }

    const errors: string[] = [];

    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push(`${path}.${key} is required`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in value) {
          errors.push(...validateAgainstSchema(propertySchema, value[key], `${path}.${key}`));
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!schema.properties || !(key in schema.properties)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    return errors;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      return [`${path} must be a string`];
    }
    return [];
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return [`${path} must be a number`];
    }
    if (schema.type === "integer" && !Number.isInteger(value)) {
      return [`${path} must be an integer`];
    }
    return [];
  }

  if (schema.type === "boolean") {
    if (typeof value !== "boolean") {
      return [`${path} must be a boolean`];
    }
    return [];
  }

  if (schema.type === "null") {
    if (value !== null) {
      return [`${path} must be null`];
    }
    return [];
  }

  return [];
}

export function parseToolInvocationPayload(payload: unknown): ToolInvocationMessage | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const type = typeof payload.type === "string" ? payload.type : undefined;
  if (type !== "tool.invocation") {
    return null;
  }

  const callId = typeof payload.call_id === "string" ? payload.call_id : typeof payload.id === "string" ? payload.id : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  const args = payload.arguments ?? payload.payload ?? payload.data;

  if (!callId || !name) {
    return null;
  }

  return {
    callId,
    name,
    arguments: args,
    createdAt: typeof payload.created_at === "string" ? payload.created_at : undefined,
  };
}

export function validateToolInvocationPayload(invocation: ToolInvocationMessage): string[] {
  const definition = TOOL_DEFINITION_MAP.get(invocation.name);
  if (!definition) {
    return [`Unknown tool: ${invocation.name}`];
  }

  return validateAgainstSchema(definition.schema, invocation.arguments, "arguments");
}

export function parseToolAcknowledgement(payload: unknown): ToolAcknowledgement | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const requestId = typeof payload.requestId === "string" ? payload.requestId : typeof payload.id === "string" ? payload.id : null;
  if (!requestId) {
    return null;
  }

  const status = payload.status === "accepted" || payload.status === "rejected" ? payload.status : null;
  if (!status) {
    return null;
  }

  const acknowledgement: ToolAcknowledgement = {
    requestId,
    status,
    timestamp: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
  };

  if (typeof payload.reason === "string") {
    acknowledgement.reason = payload.reason;
  }

  if (payload.projectStatePatch && isPlainObject(payload.projectStatePatch)) {
    acknowledgement.projectStatePatch = payload.projectStatePatch as Partial<ScriptDoc>;
  }

  if (payload.transcriptTurn && isPlainObject(payload.transcriptTurn)) {
    const turnPayload = payload.transcriptTurn;
    if (
      typeof turnPayload.id === "string" &&
      typeof turnPayload.role === "string" &&
      typeof turnPayload.text === "string" &&
      typeof turnPayload.final === "boolean" &&
      typeof turnPayload.createdAt === "string"
    ) {
      acknowledgement.transcriptTurn = {
        id: turnPayload.id,
        role: turnPayload.role,
        text: turnPayload.text,
        final: turnPayload.final,
        createdAt: turnPayload.createdAt,
        sessionId: typeof turnPayload.sessionId === "string" ? turnPayload.sessionId : undefined,
        projectId: typeof turnPayload.projectId === "string" ? turnPayload.projectId : undefined,
      };
    }
  }

  return acknowledgement;
}
