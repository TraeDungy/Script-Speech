/**
 * Fountain Export Library
 * F052: Export to Fountain format
 *
 * Converts ScriptDoc to Fountain plain-text screenplay format.
 * Fountain is a simple markup syntax for writing, editing, and sharing screenplays
 * in plain text. It's designed to be human-readable and easily parseable.
 *
 * Fountain Spec: https://fountain.io/syntax
 */

import type { ScriptDoc, ScriptScene, ScriptSceneElement } from "@/lib/scriptDoc";

/**
 * Convert a ScriptDoc to Fountain format
 * @param doc - The script document to convert
 * @returns Fountain-formatted plain text
 */
export function scriptDocToFountain(doc: ScriptDoc): string {
  const lines: string[] = [];

  // Title Page
  if (doc.metadata.title) {
    lines.push(`Title: ${doc.metadata.title}`);
  }

  if (doc.metadata.logline) {
    lines.push(`  ${doc.metadata.logline}`);
  }

  // Add author info if available from revision
  if (doc.revision?.createdBy) {
    lines.push(`Author: ${doc.revision.createdBy}`);
  }

  // Add draft info
  if (doc.revision?.version) {
    lines.push(`Draft date: ${new Date(doc.revision.createdAt).toLocaleDateString()}`);
    lines.push(`Version: ${doc.revision.version}`);
  }

  // Add genre and format info as notes
  if (doc.metadata.genre) {
    lines.push(`Genre: ${doc.metadata.genre}`);
  }

  // Blank line after title page
  if (lines.length > 0) {
    lines.push("");
    lines.push("");
  }

  // Process each scene
  for (const scene of doc.scenes) {
    lines.push(...sceneToFountain(scene, doc));
    lines.push(""); // Blank line between scenes
  }

  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Convert a single scene to Fountain format
 */
function sceneToFountain(scene: ScriptScene, doc: ScriptDoc): string[] {
  const lines: string[] = [];

  // Scene Heading (Slugline)
  // In Fountain, scene headings start with INT, EXT, or INT/EXT
  const slugline = formatSlugline(scene.slugline);
  lines.push(slugline);

  // Process scene elements
  for (const element of scene.elements) {
    lines.push(...elementToFountain(element, doc));
  }

  return lines;
}

/**
 * Format a slugline for Fountain
 * Fountain automatically recognizes lines starting with INT, EXT, or INT/EXT as scene headings
 */
function formatSlugline(slugline: {
  setting: string;
  location: string;
  timeOfDay: string;
}): string {
  return `${slugline.setting}. ${slugline.location} - ${slugline.timeOfDay}`.toUpperCase();
}

/**
 * Convert a scene element to Fountain format
 */
function elementToFountain(
  element: ScriptSceneElement,
  doc: ScriptDoc,
): string[] {
  const lines: string[] = [];

  switch (element.type) {
    case "action":
      // Action is plain text in Fountain
      // Add blank line before action for readability
      lines.push("");
      lines.push(element.text);
      break;

    case "dialogue": {
      // Dialogue format in Fountain:
      // CHARACTER NAME (all caps)
      // (parenthetical) [optional]
      // dialogue text

      // Blank line before dialogue
      lines.push("");

      // Character name (must be all uppercase)
      const characterName = element.speaker.toUpperCase();
      lines.push(characterName);

      // Parenthetical (if present)
      if (element.parenthetical) {
        lines.push(`(${element.parenthetical})`);
      }

      // Dialogue text
      lines.push(element.text);
      break;
    }

    case "parenthetical":
      // Standalone parenthetical (less common in modern scripts)
      lines.push("");
      if (element.speaker) {
        lines.push(element.speaker.toUpperCase());
      }
      lines.push(`(${element.text})`);
      break;

    case "transition":
      // Transitions in Fountain must be:
      // - All caps
      // - End with "TO:"
      // - Last thing on a line
      lines.push("");
      let transition = element.text.toUpperCase().trim();
      // Ensure it ends with colon if it doesn't already
      if (!transition.endsWith(":")) {
        // If it ends with "TO", add colon, otherwise add " TO:"
        if (transition.endsWith("TO")) {
          transition = `${transition}:`;
        } else {
          transition = `${transition} TO:`;
        }
      }
      lines.push(transition);
      break;

    case "note":
      // Notes in Fountain are enclosed in [[ ]]
      // They won't appear in the final formatted output
      lines.push("");
      lines.push(`[[ ${element.text} ]]`);
      break;

    default:
      // Unknown element type - add as action
      lines.push("");
      lines.push(element.text);
  }

  return lines;
}

/**
 * Validate that a Fountain document follows basic syntax rules
 * This is a helper for testing and debugging
 */
export function validateFountain(fountainText: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = fountainText.split("\n");

  let inDialogue = false;
  let lastWasCharacterName = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene headings (case-insensitive match)
    const upperTrimmed = trimmed.toUpperCase();
    if (
      upperTrimmed.startsWith("INT.") ||
      upperTrimmed.startsWith("EXT.") ||
      upperTrimmed.startsWith("INT/EXT.")
    ) {
      if (trimmed !== upperTrimmed) {
        warnings.push(`Line ${i + 1}: Scene heading should be all uppercase`);
      }
      inDialogue = false;
      lastWasCharacterName = false;
      continue;
    }

    // Check for character names (all caps line that's not a scene heading)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !trimmed.startsWith("[[")) {
      // Might be a character name or transition
      if (trimmed.endsWith("TO:")) {
        // It's a transition
        inDialogue = false;
        lastWasCharacterName = false;
      } else {
        // Might be a character name
        lastWasCharacterName = true;
        inDialogue = true;
      }
      continue;
    }

    // Check for parentheticals
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      if (!inDialogue && !lastWasCharacterName) {
        warnings.push(
          `Line ${i + 1}: Parenthetical appears outside of dialogue context`,
        );
      }
      lastWasCharacterName = false;
      continue;
    }

    // Check for notes
    if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
      // Valid note
      continue;
    }

    // Regular text
    lastWasCharacterName = false;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Estimate the page count of a Fountain script
 * Industry standard: ~55 lines per page
 * @param fountainText - The Fountain-formatted text
 * @returns Estimated page count
 */
export function estimatePageCount(fountainText: string): number {
  const lines = fountainText.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const LINES_PER_PAGE = 55;
  return Math.ceil(nonEmptyLines.length / LINES_PER_PAGE);
}

/**
 * Extract metadata from Fountain title page
 * This can parse title page info if needed
 */
export function extractFountainMetadata(fountainText: string): {
  title?: string;
  author?: string;
  draft?: string;
  genre?: string;
} {
  const lines = fountainText.split("\n");
  const metadata: {
    title?: string;
    author?: string;
    draft?: string;
    genre?: string;
  } = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("Title:")) {
      metadata.title = trimmed.substring(6).trim();
    } else if (trimmed.startsWith("Author:")) {
      metadata.author = trimmed.substring(7).trim();
    } else if (trimmed.startsWith("Draft date:") || trimmed.startsWith("Version:")) {
      metadata.draft = trimmed;
    } else if (trimmed.startsWith("Genre:")) {
      metadata.genre = trimmed.substring(6).trim();
    }

    // Stop after hitting the first blank line (end of title page)
    if (trimmed === "" && Object.keys(metadata).length > 0) {
      break;
    }
  }

  return metadata;
}

/**
 * Generate a filename for the Fountain export
 * @param projectId - The project ID
 * @param title - Optional title to use in filename
 * @returns Filename with .fountain extension
 */
export function generateFountainFilename(projectId: string, title?: string): string {
  const safeName = title
    ? title.replace(/[^a-z0-9-_]/gi, "_").toLowerCase()
    : projectId.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();

  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${safeName}_${timestamp}.fountain`;
}
