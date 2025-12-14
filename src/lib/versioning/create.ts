/**
 * Version Creation Utility
 * F038: Version creation
 *
 * Creates named version snapshots of scripts with metadata.
 * Builds on top of the existing script_docs table infrastructure.
 */

import type { ScriptDoc } from "@/lib/scriptDoc";
import { createScriptDocVersion, type ScriptDocRecord } from "@/lib/db/scriptDocs";

export interface CreateVersionInput {
  projectId: string;
  doc: ScriptDoc;
  versionName?: string;
  description?: string;
  createdBy?: string;
}

export interface VersionMetadata {
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  versionNumber: number;
  totalScenes: number;
  totalCharacters: number;
  wordCount: number;
}

/**
 * Create a named version snapshot of a script
 */
export async function createVersion(
  input: CreateVersionInput
): Promise<ScriptDocRecord> {
  // Add version metadata to the script doc
  const docWithMetadata: ScriptDoc = {
    ...input.doc,
    metadata: {
      ...input.doc.metadata,
      versionName: input.versionName,
      versionDescription: input.description,
      versionCreatedBy: input.createdBy,
      versionCreatedAt: new Date().toISOString(),
    },
  };

  // Use existing createScriptDocVersion to save to DB
  const record = await createScriptDocVersion(input.projectId, docWithMetadata);

  return record;
}

/**
 * Extract version metadata from a script doc record
 */
export function extractVersionMetadata(record: ScriptDocRecord): VersionMetadata {
  const doc = record.doc;
  const metadata = doc.metadata;

  return {
    name: metadata?.versionName || `Version ${record.versionNumber}`,
    description: metadata?.versionDescription,
    createdBy: metadata?.versionCreatedBy,
    createdAt: record.createdAt,
    versionNumber: record.versionNumber || 1,
    totalScenes: doc.scenes?.length || 0,
    totalCharacters: doc.characters?.length || 0,
    wordCount: calculateWordCount(doc),
  };
}

/**
 * Calculate approximate word count from script doc
 */
function calculateWordCount(doc: ScriptDoc): number {
  let count = 0;

  // Count words in title
  if (doc.metadata?.title) {
    count += doc.metadata.title.split(/\s+/).length;
  }

  // Count words in logline
  if (doc.metadata?.logline) {
    count += doc.metadata.logline.split(/\s+/).length;
  }

  // Count words in scenes
  if (doc.scenes) {
    for (const scene of doc.scenes) {
      // Slugline
      if (scene.slugline) {
        count += scene.slugline.split(/\s+/).length;
      }

      // Scene elements (action, dialogue, etc.)
      if (scene.elements) {
        for (const element of scene.elements) {
          if (element.text) {
            count += element.text.split(/\s+/).length;
          }
        }
      }
    }
  }

  return count;
}

/**
 * Generate default version name based on version number
 */
export function generateDefaultVersionName(versionNumber: number): string {
  return `Version ${versionNumber}`;
}

/**
 * Validate version name
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateVersionName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: "Version name is required",
    };
  }

  if (name.length > 100) {
    return {
      isValid: false,
      error: "Version name must be 100 characters or less",
    };
  }

  return { isValid: true };
}

/**
 * Validate version description
 */
export function validateVersionDescription(description?: string): ValidationResult {
  if (description && description.length > 500) {
    return {
      isValid: false,
      error: "Description must be 500 characters or less",
    };
  }

  return { isValid: true };
}

/**
 * Create a version with validation
 */
export async function createVersionWithValidation(
  input: CreateVersionInput
): Promise<{ success: boolean; record?: ScriptDocRecord; error?: string }> {
  // Validate version name if provided
  if (input.versionName) {
    const nameValidation = validateVersionName(input.versionName);
    if (!nameValidation.isValid) {
      return {
        success: false,
        error: nameValidation.error,
      };
    }
  }

  // Validate description if provided
  if (input.description) {
    const descValidation = validateVersionDescription(input.description);
    if (!descValidation.isValid) {
      return {
        success: false,
        error: descValidation.error,
      };
    }
  }

  try {
    const record = await createVersion(input);
    return {
      success: true,
      record,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create version",
    };
  }
}

/**
 * Compare two versions to see what changed
 */
export interface VersionComparison {
  scenesAdded: number;
  scenesRemoved: number;
  scenesModified: number;
  charactersAdded: number;
  charactersRemoved: number;
  wordCountDiff: number;
}

export function compareVersions(
  oldVersion: ScriptDocRecord,
  newVersion: ScriptDocRecord
): VersionComparison {
  const oldMetadata = extractVersionMetadata(oldVersion);
  const newMetadata = extractVersionMetadata(newVersion);

  const oldSceneIds = new Set(oldVersion.doc.scenes?.map((s) => s.id) || []);
  const newSceneIds = new Set(newVersion.doc.scenes?.map((s) => s.id) || []);

  const scenesAdded = Array.from(newSceneIds).filter((id) => !oldSceneIds.has(id)).length;
  const scenesRemoved = Array.from(oldSceneIds).filter((id) => !newSceneIds.has(id)).length;
  const commonScenes = Array.from(newSceneIds).filter((id) => oldSceneIds.has(id)).length;
  const scenesModified = commonScenes; // Simplified - would need deep comparison

  const oldCharacterIds = new Set(oldVersion.doc.characters?.map((c) => c.id) || []);
  const newCharacterIds = new Set(newVersion.doc.characters?.map((c) => c.id) || []);

  const charactersAdded = Array.from(newCharacterIds).filter((id) => !oldCharacterIds.has(id)).length;
  const charactersRemoved = Array.from(oldCharacterIds).filter((id) => !newCharacterIds.has(id)).length;

  return {
    scenesAdded,
    scenesRemoved,
    scenesModified,
    charactersAdded,
    charactersRemoved,
    wordCountDiff: newMetadata.wordCount - oldMetadata.wordCount,
  };
}
