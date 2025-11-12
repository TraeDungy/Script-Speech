export type ScriptFormatId = string;
export interface ScriptFormatDefinition {
  id: ScriptFormatId;
  label: string;
}
export interface ScriptFormatLengthProfile {
  unit: "pages" | "minutes" | "seconds";
  typical?: number;
  min?: number;
  max?: number;
}
export declare function listScriptFormats(): ScriptFormatDefinition[];
