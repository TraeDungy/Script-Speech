import { zodToJsonSchema } from "zod-to-json-schema";

import {
  beatResponseSchema,
  orchestrationContextSchema,
  plannerResponseSchema,
  sceneBatchSchema,
  scriptDocUpdateSchema,
} from "@/lib/ai/schemas";
import { TOOL_DEFINITIONS } from "@/lib/realtime/schema";

function buildSchema(name: string, schema: Parameters<typeof zodToJsonSchema>[0]) {
  return {
    name,
    schema: zodToJsonSchema(schema, name),
    strict: true,
  } as const;
}

export function getAgentSchemaPayload() {
  return {
    tools: TOOL_DEFINITIONS,
    agents: {
      planner: buildSchema("ScriptDocPlannerResponse", plannerResponseSchema),
      beat: buildSchema("ScriptDocBeat", beatResponseSchema),
      scenes: buildSchema("ScriptDocSceneBatch", sceneBatchSchema),
      context: buildSchema("ScriptDocRetrievalContext", orchestrationContextSchema),
      update: buildSchema("ScriptDocUpdate", scriptDocUpdateSchema),
    },
  };
}
