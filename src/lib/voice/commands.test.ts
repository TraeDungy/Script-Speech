/**
 * Tests for Voice Command Manager
 * F011: Voice command detection and execution
 */

import { describe, it, expect, vi } from "vitest";
import { VoiceCommandManager, createCommandManager, createDebouncedProcessor } from "./commands";
import type { VoiceCommand } from "./commandParser";

describe("Voice Command Manager (F011)", () => {
  describe("Initialization", () => {
    it("should create manager with default parser", () => {
      const manager = createCommandManager();
      expect(manager).toBeInstanceOf(VoiceCommandManager);
    });
  });

  describe("Handler Registration", () => {
    it("should register command handler", () => {
      const manager = createCommandManager();
      const handler = vi.fn();

      manager.registerHandler("new_scene", handler);
      expect(manager.isSupported("new_scene")).toBe(true);
    });

    it("should unregister command handler", () => {
      const manager = createCommandManager();
      const handler = vi.fn();

      manager.registerHandler("new_scene", handler);
      manager.unregisterHandler("new_scene");

      expect(manager.isSupported("new_scene")).toBe(false);
    });

    it("should list available commands", () => {
      const manager = createCommandManager();

      manager.registerHandler("new_scene", vi.fn());
      manager.registerHandler("delete", vi.fn());

      const commands = manager.getAvailableCommands();
      expect(commands).toContain("new_scene");
      expect(commands).toContain("delete");
    });
  });

  describe("Command Processing", () => {
    it("should process text and execute command", async () => {
      const manager = createCommandManager();
      const handler = vi.fn();

      manager.registerHandler("new_scene", handler);

      const result = await manager.processText("new scene");
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it("should return null for unrecognized text", async () => {
      const manager = createCommandManager();

      const result = await manager.processText("this is not a command");
      expect(result).toBeNull();
    });

    it("should return error for unregistered command", async () => {
      const manager = createCommandManager();

      const result = await manager.processText("new scene");
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error).toContain("No handler registered");
    });

    it("should pass command to handler", async () => {
      const manager = createCommandManager();
      let receivedCommand: VoiceCommand | null = null;

      manager.registerHandler("new_scene", (command) => {
        receivedCommand = command;
      });

      await manager.processText("new scene");

      expect(receivedCommand).not.toBeNull();
      expect(receivedCommand?.type).toBe("new_scene");
    });
  });

  describe("Command Execution", () => {
    it("should execute synchronous handler", async () => {
      const manager = createCommandManager();
      const handler = vi.fn();

      manager.registerHandler("save", handler);

      await manager.processText("save");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should execute asynchronous handler", async () => {
      const manager = createCommandManager();
      const handler = vi.fn().mockResolvedValue(undefined);

      manager.registerHandler("save", handler);

      await manager.processText("save");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should handle handler errors", async () => {
      const manager = createCommandManager();
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));

      manager.registerHandler("save", handler);

      const result = await manager.processText("save");

      expect(result?.success).toBe(false);
      expect(result?.error).toContain("Handler failed");
    });

    it("should execute directly via execute()", async () => {
      const manager = createCommandManager();
      const handler = vi.fn();

      manager.registerHandler("undo", handler);

      const command: VoiceCommand = {
        type: "undo",
        rawText: "undo",
        params: {},
        confidence: 0.9,
        timestamp: Date.now(),
      };

      const result = await manager.execute(command);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Command History", () => {
    it("should track command history", async () => {
      const manager = createCommandManager();
      manager.registerHandler("new_scene", vi.fn());

      await manager.processText("new scene");

      const history = manager.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe("new_scene");
    });

    it("should maintain history order", async () => {
      const manager = createCommandManager();
      manager.registerHandler("new_scene", vi.fn());
      manager.registerHandler("save", vi.fn());

      await manager.processText("new scene");
      await manager.processText("save");

      const history = manager.getHistory();
      expect(history[0].type).toBe("new_scene");
      expect(history[1].type).toBe("save");
    });

    it("should get last command", async () => {
      const manager = createCommandManager();
      manager.registerHandler("undo", vi.fn());

      await manager.processText("undo");

      const lastCommand = manager.getLastCommand();
      expect(lastCommand?.type).toBe("undo");
    });

    it("should return null when history is empty", () => {
      const manager = createCommandManager();

      const lastCommand = manager.getLastCommand();
      expect(lastCommand).toBeNull();
    });

    it("should clear history", async () => {
      const manager = createCommandManager();
      manager.registerHandler("save", vi.fn());

      await manager.processText("save");
      expect(manager.getHistory().length).toBe(1);

      manager.clearHistory();
      expect(manager.getHistory().length).toBe(0);
    });

    it("should limit history size", async () => {
      const manager = createCommandManager();
      manager.registerHandler("save", vi.fn());

      // Execute many commands
      for (let i = 0; i < 60; i++) {
        await manager.processText("save");
      }

      const history = manager.getHistory();
      // Should be capped at max size (50)
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Help System", () => {
    it("should provide help information", () => {
      const manager = createCommandManager();

      const help = manager.getHelp();
      expect(help.length).toBeGreaterThan(0);
      expect(help[0]).toHaveProperty("type");
      expect(help[0]).toHaveProperty("description");
    });
  });

  describe("Debounced Processor", () => {
    it("should create debounced processor", () => {
      const manager = createCommandManager();
      const processor = createDebouncedProcessor(manager);

      expect(typeof processor).toBe("function");
    });

    it("should prevent duplicate commands", async () => {
      const manager = createCommandManager();
      const handler = vi.fn();
      manager.registerHandler("save", handler);

      const processor = createDebouncedProcessor(manager, 100);

      await processor("save");
      const result = await processor("save");

      // Second call should be ignored due to debounce
      expect(result).toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should allow command after debounce period", async () => {
      const manager = createCommandManager();
      const handler = vi.fn();
      manager.registerHandler("save", handler);

      const processor = createDebouncedProcessor(manager, 50);

      await processor("save");

      // Wait for debounce period
      await new Promise((resolve) => setTimeout(resolve, 60));

      await processor("save");

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should allow different commands immediately", async () => {
      const manager = createCommandManager();
      const saveHandler = vi.fn();
      const undoHandler = vi.fn();

      manager.registerHandler("save", saveHandler);
      manager.registerHandler("undo", undoHandler);

      const processor = createDebouncedProcessor(manager, 100);

      await processor("save");
      await processor("undo");

      expect(saveHandler).toHaveBeenCalledTimes(1);
      expect(undoHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Parameter Passing", () => {
    it("should pass command parameters to handler", async () => {
      const manager = createCommandManager();
      let receivedParams: Record<string, string | number | boolean> = {};

      manager.registerHandler("new_character", (command) => {
        receivedParams = command.params;
      });

      await manager.processText("new character named Alice");

      expect(receivedParams.name).toBe("Alice");
    });

    it("should handle commands without parameters", async () => {
      const manager = createCommandManager();
      let receivedParams: Record<string, string | number | boolean> = {};

      manager.registerHandler("save", (command) => {
        receivedParams = command.params;
      });

      await manager.processText("save");

      expect(Object.keys(receivedParams).length).toBe(0);
    });
  });

  describe("Command Support Check", () => {
    it("should check if command is supported", () => {
      const manager = createCommandManager();

      manager.registerHandler("new_scene", vi.fn());

      expect(manager.isSupported("new_scene")).toBe(true);
      expect(manager.isSupported("nonexistent")).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should process commands quickly (< 100ms)", async () => {
      const manager = createCommandManager();
      manager.registerHandler("save", vi.fn());

      const start = Date.now();
      await manager.processText("save");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should handle multiple commands efficiently", async () => {
      const manager = createCommandManager();
      manager.registerHandler("save", vi.fn());

      const start = Date.now();

      for (let i = 0; i < 50; i++) {
        await manager.processText("save");
      }

      const duration = Date.now() - start;

      // 50 commands should process reasonably fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty text", async () => {
      const manager = createCommandManager();

      const result = await manager.processText("");
      expect(result).toBeNull();
    });

    it("should handle whitespace", async () => {
      const manager = createCommandManager();

      const result = await manager.processText("   ");
      expect(result).toBeNull();
    });

    it("should handle handler returning value", async () => {
      const manager = createCommandManager();
      manager.registerHandler("save", () => "done");

      const result = await manager.processText("save");
      expect(result?.success).toBe(true);
    });
  });
});
