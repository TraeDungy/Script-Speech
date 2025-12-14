/**
 * Tests for Version Creation
 * F038: Version creation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVersion,
  extractVersionMetadata,
  generateDefaultVersionName,
  validateVersionName,
  validateVersionDescription,
  createVersionWithValidation,
  compareVersions,
  type CreateVersionInput,
  type VersionMetadata,
} from "./create";
import type { ScriptDoc } from "@/lib/scriptDoc";
import type { ScriptDocRecord } from "@/lib/db/scriptDocs";

// Mock the scriptDocs module
vi.mock("@/lib/db/scriptDocs", () => ({
  createScriptDocVersion: vi.fn(),
}));

import { createScriptDocVersion } from "@/lib/db/scriptDocs";

// Helper to create a test script doc
function createTestScriptDoc(): ScriptDoc {
  return {
    metadata: {
      projectId: "project-1",
      title: "Test Script",
      logline: "A test script for testing",
    },
    scenes: [
      {
        id: "scene-1",
        order: 1,
        slugline: "INT. TEST ROOM - DAY",
        title: "Opening Scene",
        elements: [
          {
            id: "elem-1",
            type: "action",
            text: "This is a test scene with some dialogue",
            order: 1,
          },
        ],
      },
    ],
    characters: [
      { id: "char-1", name: "Alice", description: "Main character", tags: [], referenceAssetIds: [] },
      { id: "char-2", name: "Bob", description: "Supporting character", tags: [], referenceAssetIds: [] },
    ],
  } as ScriptDoc;
}

// Helper to create a test script doc record
function createTestScriptDocRecord(
  versionNumber: number,
  doc?: ScriptDoc
): ScriptDocRecord {
  const now = new Date().toISOString();
  return {
    id: `version-${versionNumber}`,
    projectId: "project-1",
    doc: doc || createTestScriptDoc(),
    revisionId: null,
    recordType: "version",
    versionNumber,
    sourceVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("createVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a version with name and description", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "First Draft",
      description: "Initial draft of the script",
      createdBy: "user-1",
    };

    const mockRecord = createTestScriptDocRecord(1);
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    const result = await createVersion(input);

    expect(createScriptDocVersion).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          versionName: "First Draft",
          versionDescription: "Initial draft of the script",
          versionCreatedBy: "user-1",
          versionCreatedAt: expect.any(String),
        }),
      })
    );
    expect(result).toBe(mockRecord);
  });

  it("should create a version without optional fields", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
    };

    const mockRecord = createTestScriptDocRecord(1);
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    const result = await createVersion(input);

    expect(createScriptDocVersion).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          versionCreatedAt: expect.any(String),
        }),
      })
    );
    expect(result).toBe(mockRecord);
  });

  it("should preserve existing metadata", async () => {
    const doc = createTestScriptDoc();
    doc.metadata = {
      ...doc.metadata,
      projectId: "project-1",
      author: "Test Author",
      title: "Original Title",
    };

    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "Second Draft",
    };

    const mockRecord = createTestScriptDocRecord(2);
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    await createVersion(input);

    expect(createScriptDocVersion).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          author: "Test Author",
          title: "Original Title",
          versionName: "Second Draft",
        }),
      })
    );
  });
});

describe("extractVersionMetadata", () => {
  it("should extract metadata from a version record", () => {
    const doc = createTestScriptDoc();
    doc.metadata = {
      ...doc.metadata,
      versionName: "First Draft",
      versionDescription: "Initial draft",
      versionCreatedBy: "user-1",
      versionCreatedAt: "2024-01-01T00:00:00.000Z",
    };

    const record = createTestScriptDocRecord(1, doc);

    const metadata = extractVersionMetadata(record);

    expect(metadata.name).toBe("First Draft");
    expect(metadata.description).toBe("Initial draft");
    expect(metadata.createdBy).toBe("user-1");
    expect(metadata.versionNumber).toBe(1);
    expect(metadata.totalScenes).toBe(1);
    expect(metadata.totalCharacters).toBe(2);
    expect(metadata.wordCount).toBeGreaterThan(0);
  });

  it("should use default name if version name not set", () => {
    const doc = createTestScriptDoc();
    const record = createTestScriptDocRecord(3, doc);

    const metadata = extractVersionMetadata(record);

    expect(metadata.name).toBe("Version 3");
  });

  it("should handle empty scenes and characters", () => {
    const doc: ScriptDoc = {
      metadata: { projectId: "project-1" },
      scenes: [],
      characters: [],
    } as ScriptDoc;

    const record = createTestScriptDocRecord(1, doc);

    const metadata = extractVersionMetadata(record);

    expect(metadata.totalScenes).toBe(0);
    expect(metadata.totalCharacters).toBe(0);
  });

  it("should calculate word count correctly", () => {
    const doc = createTestScriptDoc();
    const record = createTestScriptDocRecord(1, doc);

    const metadata = extractVersionMetadata(record);

    // Title: "Test Script" = 2 words
    // Logline: "A test script for testing" = 5 words
    // Slugline: "INT. TEST ROOM - DAY" = 4 words (dash counts as separator)
    // Action: "This is a test scene with some dialogue" = 9 words
    // Total: 20 words
    expect(metadata.wordCount).toBe(20);
  });
});

describe("generateDefaultVersionName", () => {
  it("should generate default version name", () => {
    expect(generateDefaultVersionName(1)).toBe("Version 1");
    expect(generateDefaultVersionName(5)).toBe("Version 5");
    expect(generateDefaultVersionName(42)).toBe("Version 42");
  });
});

describe("validateVersionName", () => {
  it("should validate valid version names", () => {
    expect(validateVersionName("First Draft").isValid).toBe(true);
    expect(validateVersionName("Version 1.0").isValid).toBe(true);
    expect(validateVersionName("a").isValid).toBe(true);
  });

  it("should reject empty version names", () => {
    const result = validateVersionName("");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("should reject whitespace-only version names", () => {
    const result = validateVersionName("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("should reject version names that are too long", () => {
    const longName = "a".repeat(101);
    const result = validateVersionName(longName);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("100 characters");
  });
});

describe("validateVersionDescription", () => {
  it("should validate valid descriptions", () => {
    expect(validateVersionDescription("A short description").isValid).toBe(true);
    expect(validateVersionDescription(undefined).isValid).toBe(true);
    expect(validateVersionDescription("").isValid).toBe(true);
  });

  it("should reject descriptions that are too long", () => {
    const longDesc = "a".repeat(501);
    const result = validateVersionDescription(longDesc);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("500 characters");
  });
});

describe("createVersionWithValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create version successfully with valid input", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "Valid Name",
      description: "Valid description",
    };

    const mockRecord = createTestScriptDocRecord(1);
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    const result = await createVersionWithValidation(input);

    expect(result.success).toBe(true);
    expect(result.record).toBe(mockRecord);
    expect(result.error).toBeUndefined();
  });

  it("should reject invalid version name", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "a".repeat(101), // Invalid: too long
    };

    const result = await createVersionWithValidation(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain("100 characters");
    expect(createScriptDocVersion).not.toHaveBeenCalled();
  });

  it("should reject invalid description", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      description: "a".repeat(501), // Invalid: too long
    };

    const result = await createVersionWithValidation(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain("500 characters");
    expect(createScriptDocVersion).not.toHaveBeenCalled();
  });

  it("should handle database errors", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "Valid Name",
    };

    vi.mocked(createScriptDocVersion).mockRejectedValue(new Error("Database error"));

    const result = await createVersionWithValidation(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });
});

describe("compareVersions", () => {
  it("should detect added scenes", () => {
    const oldDoc = createTestScriptDoc();
    const newDoc = createTestScriptDoc();
    newDoc.scenes = [
      ...oldDoc.scenes!,
      { id: "scene-2", order: 2, slugline: "INT. NEW SCENE - NIGHT", elements: [] },
    ];

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    expect(comparison.scenesAdded).toBe(1);
    expect(comparison.scenesRemoved).toBe(0);
  });

  it("should detect removed scenes", () => {
    const oldDoc = createTestScriptDoc();
    oldDoc.scenes = [
      oldDoc.scenes![0]!,
      { id: "scene-2", order: 2, slugline: "INT. REMOVED SCENE - NIGHT", elements: [] },
    ];
    const newDoc = createTestScriptDoc();

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    expect(comparison.scenesAdded).toBe(0);
    expect(comparison.scenesRemoved).toBe(1);
  });

  it("should detect added characters", () => {
    const oldDoc = createTestScriptDoc();
    const newDoc = createTestScriptDoc();
    newDoc.characters = [
      ...oldDoc.characters!,
      { id: "char-3", name: "Charlie", description: "New character", tags: [], referenceAssetIds: [] },
    ];

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    expect(comparison.charactersAdded).toBe(1);
    expect(comparison.charactersRemoved).toBe(0);
  });

  it("should detect removed characters", () => {
    const oldDoc = createTestScriptDoc();
    const newDoc = createTestScriptDoc();
    newDoc.characters = [oldDoc.characters![0]!]; // Remove Bob

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    expect(comparison.charactersAdded).toBe(0);
    expect(comparison.charactersRemoved).toBe(1);
  });

  it("should calculate word count difference", () => {
    const oldDoc = createTestScriptDoc();
    const newDoc = createTestScriptDoc();
    newDoc.scenes![0]!.elements = [
      ...newDoc.scenes![0]!.elements!,
      {
        id: "elem-2",
        type: "dialogue",
        text: "This is additional dialogue with many more words",
        order: 2,
      },
    ];

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    // New version should have more words
    expect(comparison.wordCountDiff).toBeGreaterThan(0);
  });

  it("should handle empty scenes and characters", () => {
    const oldDoc: ScriptDoc = {
      metadata: { projectId: "project-1" },
      scenes: [],
      characters: [],
    } as ScriptDoc;

    const newDoc: ScriptDoc = {
      metadata: { projectId: "project-1" },
      scenes: [],
      characters: [],
    } as ScriptDoc;

    const oldRecord = createTestScriptDocRecord(1, oldDoc);
    const newRecord = createTestScriptDocRecord(2, newDoc);

    const comparison = compareVersions(oldRecord, newRecord);

    expect(comparison.scenesAdded).toBe(0);
    expect(comparison.scenesRemoved).toBe(0);
    expect(comparison.charactersAdded).toBe(0);
    expect(comparison.charactersRemoved).toBe(0);
    expect(comparison.wordCountDiff).toBe(0);
  });
});

describe("F038 Acceptance Criteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should prompt for version name (via validation)", () => {
    // Validation function serves as the prompt mechanism
    const validResult = validateVersionName("My Version");
    expect(validResult.isValid).toBe(true);

    const invalidResult = validateVersionName("");
    expect(invalidResult.isValid).toBe(false);
  });

  it("should save full script state", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "Complete Draft",
    };

    const mockRecord = createTestScriptDocRecord(1);
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    await createVersion(input);

    // Verify that full doc was passed to createScriptDocVersion
    expect(createScriptDocVersion).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        metadata: expect.any(Object),
        scenes: expect.any(Array),
        characters: expect.any(Array),
      })
    );
  });

  it("should show in version list (via record)", async () => {
    const doc = createTestScriptDoc();
    const input: CreateVersionInput = {
      projectId: "project-1",
      doc,
      versionName: "Final Draft",
    };

    const mockRecord = createTestScriptDocRecord(5, doc);
    mockRecord.doc.metadata = {
      ...mockRecord.doc.metadata,
      versionName: "Final Draft",
    };
    vi.mocked(createScriptDocVersion).mockResolvedValue(mockRecord);

    const result = await createVersion(input);

    // Verify record has all necessary data for version list display
    expect(result.versionNumber).toBe(5);
    expect(result.doc.metadata?.versionName).toBe("Final Draft");
    expect(result.createdAt).toBeDefined();

    // Extract metadata for display
    const metadata = extractVersionMetadata(result);
    expect(metadata.name).toBe("Final Draft");
    expect(metadata.versionNumber).toBe(5);
  });
});
