import type { ScriptFormatDefinition, ScriptFormatId, ScriptFormatLengthProfile } from "@/lib/scriptFormats";

export interface ScriptDocTranscriptEntry {
  id: string;
  role: string;
  text: string;
  final: boolean;
  createdAt: string;
}

export interface ScriptDocConceptAnalysis {
  conceptSummary: string;
  keywords: string[];
  conversationLog?: ScriptDocTranscriptEntry[];
}

export interface ScriptDocMetadata {
  projectId: string;
  title: string;
  format: ScriptFormatId;
  genre: string;
  logline: string;
  toneKeywords: string[];
  targetLength: { unit: "pages" | "minutes" | "seconds"; value: number };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptDoc {
  metadata: ScriptDocMetadata;
  conceptAnalysis: ScriptDocConceptAnalysis;
  beats: Array<{ id: string; order: number; title: string; sceneIds?: string[] }>;
  scenes: Array<{ id: string; order: number; beatId: string; elements: Array<{ id: string; type: string }> }>;
}
