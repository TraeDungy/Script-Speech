import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useScriptDocStore } from "./scriptDocStore";

describe("scriptDocStore", () => {
  beforeEach(() => {
    act(() => {
      const initial = useScriptDocStore.getState().doc;
      useScriptDocStore.getState().loadDoc(initial);
    });
  });

  it("supports undo/redo around metadata updates", () => {
    const originalTitle = useScriptDocStore.getState().doc.metadata.title;

    act(() => {
      useScriptDocStore.getState().updateMetadata({ title: "New Title" });
    });

    expect(useScriptDocStore.getState().doc.metadata.title).toBe("New Title");
    expect(useScriptDocStore.getState().hasUndo).toBe(true);

    act(() => {
      useScriptDocStore.getState().undo();
    });

    expect(useScriptDocStore.getState().doc.metadata.title).toBe(originalTitle);
    expect(useScriptDocStore.getState().hasRedo).toBe(true);

    act(() => {
      useScriptDocStore.getState().redo();
    });

    expect(useScriptDocStore.getState().doc.metadata.title).toBe("New Title");
  });

  it("merges patches deeply", () => {
    act(() => {
      useScriptDocStore.getState().applyPatch({
        metadata: {
          targetLength: { unit: "pages", value: 90 },
          relatedProjects: [{ projectId: "new", relationship: "spinoff", title: "Spin", notes: "" }],
        },
      });
    });

    const state = useScriptDocStore.getState();
    expect(state.doc.metadata.targetLength?.value).toBe(90);
    expect(state.doc.metadata.relatedProjects?.[0]?.projectId).toBe("new");
  });

  it("appends transcript turns chronologically", () => {
    const now = Date.now();
    const first = {
      id: "t1",
      role: "user" as const,
      text: "Hello",
      final: true,
      createdAt: new Date(now).toISOString(),
    };
    const second = {
      id: "t2",
      role: "assistant" as const,
      text: "Hi",
      final: false,
      createdAt: new Date(now + 1000).toISOString(),
    };
    const outOfOrder = {
      id: "t3",
      role: "assistant" as const,
      text: "Late",
      final: true,
      createdAt: new Date(now - 1000).toISOString(),
    };

    act(() => {
      useScriptDocStore.getState().appendTranscriptTurn(second);
      useScriptDocStore.getState().appendTranscriptTurn(first);
      useScriptDocStore.getState().appendTranscriptTurn(outOfOrder);
    });

    const log = useScriptDocStore.getState().doc.conceptAnalysis.conversationLog;
    expect(log?.map((entry) => entry.id)).toEqual(["t3", "t1", "t2"]);
  });
});
