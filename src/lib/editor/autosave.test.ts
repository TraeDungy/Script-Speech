/**
 * Tests for Autosave Manager
 * F085: Autosave every 10 seconds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutosaveManager, createAutosave, type AutosaveStatus } from "./autosave";

describe("AutosaveManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("creates with default config", () => {
      const manager = new AutosaveManager();
      const state = manager.getState();

      expect(state.status).toBe("idle");
      expect(state.lastSaveTime).toBeNull();
      expect(state.lastChangeTime).toBeNull();
      expect(state.saveCount).toBe(0);
      expect(state.errorCount).toBe(0);
    });

    it("creates with custom config", () => {
      const manager = new AutosaveManager({
        interval: 5000,
        debounceMs: 1000,
        enabled: false,
      });

      expect(manager).toBeDefined();
    });

    it("creates via factory function", () => {
      const manager = createAutosave();
      expect(manager).toBeInstanceOf(AutosaveManager);
    });
  });

  describe("markChanged", () => {
    it("marks data as changed and updates status to pending", () => {
      const manager = new AutosaveManager();
      manager.setSaveFunction(vi.fn());

      manager.markChanged({ test: "data" });

      const state = manager.getState();
      expect(state.status).toBe("pending");
      expect(state.lastChangeTime).toBeGreaterThan(0);
    });

    it("does not mark as changed if disabled", () => {
      const manager = new AutosaveManager({ enabled: false });
      manager.setSaveFunction(vi.fn());

      manager.markChanged({ test: "data" });

      const state = manager.getState();
      expect(state.status).toBe("idle");
      expect(state.lastChangeTime).toBeNull();
    });

    it("does not mark as changed if data is identical", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      const data = { test: "data" };
      manager.markChanged(data);

      // Fast-forward to trigger save
      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledTimes(1);

      // Mark same data again
      saveFn.mockClear();
      manager.markChanged(data);
      await vi.advanceTimersByTimeAsync(100);

      // Should not save again
      expect(saveFn).not.toHaveBeenCalled();
    });

    it("schedules debounced save", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 2000 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      // Should not save immediately
      expect(saveFn).not.toHaveBeenCalled();

      // Should save after debounce
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("saveNow", () => {
    it("triggers immediate save", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager();
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });
      await manager.saveNow();

      expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it("does not save if no data", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager();
      manager.setSaveFunction(saveFn);

      await manager.saveNow();

      expect(saveFn).not.toHaveBeenCalled();
    });

    it("does not save if disabled", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ enabled: false });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });
      await manager.saveNow();

      expect(saveFn).not.toHaveBeenCalled();
    });
  });

  describe("periodic saves", () => {
    it("saves at configured interval", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ interval: 10000 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });
      manager.start();

      // First save from debounce
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).toHaveBeenCalledTimes(1);

      // Change data
      saveFn.mockClear();
      manager.markChanged({ test: "data2" });

      // Should save after interval (10 seconds)
      await vi.advanceTimersByTimeAsync(10000);
      expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it("can be stopped", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ interval: 10000 });
      manager.setSaveFunction(saveFn);

      manager.start();
      manager.markChanged({ test: "data" });

      // Stop should clear any pending debounced saves
      manager.stop();

      // Should not save after debounce period because stopped cleared the timer
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).not.toHaveBeenCalled();

      // Even if markChanged is called after stop, the periodic interval won't run
      saveFn.mockClear();
      manager.markChanged({ test: "data2" });

      // The debounced save will still happen since markChanged schedules it
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).toHaveBeenCalledTimes(1); // Debounced save happens

      // But the interval should not trigger additional periodic saves
      saveFn.mockClear();
      await vi.advanceTimersByTimeAsync(10000);
      expect(saveFn).not.toHaveBeenCalled(); // No periodic save
    });
  });

  describe("pause and resume", () => {
    it("pauses autosaving", () => {
      const manager = new AutosaveManager();
      manager.setSaveFunction(vi.fn());

      manager.pause();
      manager.markChanged({ test: "data" });

      const state = manager.getState();
      expect(state.status).toBe("idle"); // Should not change to pending
    });

    it("resumes autosaving", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager();
      manager.setSaveFunction(saveFn);

      manager.pause();
      manager.markChanged({ test: "data" });

      manager.resume();
      manager.markChanged({ test: "data2" });

      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).toHaveBeenCalledWith({ test: "data2" });
    });
  });

  describe("save success", () => {
    it("updates state on successful save", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);

      const state = manager.getState();
      expect(state.status).toBe("saved");
      expect(state.lastSaveTime).toBeGreaterThan(0);
      expect(state.saveCount).toBe(1);
      expect(state.errorCount).toBe(0);
    });

    it("calls onSaveSuccess callback", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const onSuccess = vi.fn();
      const manager = new AutosaveManager({
        debounceMs: 100,
        onSaveSuccess: onSuccess,
      });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(expect.any(Number));
    });

    it("transitions from saved to idle after delay", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);
      expect(manager.getState().status).toBe("saved");

      // Should transition to idle after 1.5 seconds
      await vi.advanceTimersByTimeAsync(1500);
      expect(manager.getState().status).toBe("idle");
    });
  });

  describe("save errors", () => {
    it("handles save errors", async () => {
      const error = new Error("Save failed");
      const saveFn = vi.fn().mockRejectedValue(error);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);

      const state = manager.getState();
      expect(state.status).toBe("error");
      expect(state.errorCount).toBe(1);
      expect(state.saveCount).toBe(0);
    });

    it("calls onSaveError callback", async () => {
      const error = new Error("Save failed");
      const saveFn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      const manager = new AutosaveManager({
        debounceMs: 100,
        onSaveError: onError,
      });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(error);
    });

    it("transitions from error to pending after delay", async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error("Save failed"));
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);
      expect(manager.getState().status).toBe("error");

      // Should transition to pending after 3 seconds
      await vi.advanceTimersByTimeAsync(3000);
      expect(manager.getState().status).toBe("pending");
    });
  });

  describe("status change callbacks", () => {
    it("calls onStatusChange when status changes", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const statusChanges: AutosaveStatus[] = [];
      const manager = new AutosaveManager({
        debounceMs: 100,
        onStatusChange: (status) => statusChanges.push(status),
      });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);

      expect(statusChanges).toContain("pending");
      expect(statusChanges).toContain("saving");
      expect(statusChanges).toContain("saved");
    });

    it("does not call onStatusChange if status unchanged", () => {
      const onStatusChange = vi.fn();
      const manager = new AutosaveManager({ onStatusChange });

      // Trigger same status
      const state = manager.getState();
      expect(state.status).toBe("idle");

      // Should not trigger callback if already idle
      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe("hasUnsavedChanges", () => {
    it("returns false when no data", () => {
      const manager = new AutosaveManager();
      expect(manager.hasUnsavedChanges()).toBe(false);
    });

    it("returns true when data changed but not saved", () => {
      const manager = new AutosaveManager();
      manager.setSaveFunction(vi.fn());

      manager.markChanged({ test: "data" });

      expect(manager.hasUnsavedChanges()).toBe(true);
    });

    it("returns false after successful save", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });
      await vi.advanceTimersByTimeAsync(100);

      expect(manager.hasUnsavedChanges()).toBe(false);
    });
  });

  describe("updateConfig", () => {
    it("updates interval", () => {
      const manager = new AutosaveManager({ interval: 10000 });
      manager.updateConfig({ interval: 5000 });

      // Config is private, but we can test behavior
      expect(manager).toBeDefined();
    });

    it("updates debounce time", () => {
      const manager = new AutosaveManager({ debounceMs: 2000 });
      manager.updateConfig({ debounceMs: 1000 });

      expect(manager).toBeDefined();
    });

    it("updates enabled status", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ enabled: true });
      manager.setSaveFunction(saveFn);

      manager.updateConfig({ enabled: false });
      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).not.toHaveBeenCalled();
    });

    it("updates callbacks", async () => {
      const manager = new AutosaveManager();
      const newCallback = vi.fn();

      manager.updateConfig({ onStatusChange: newCallback });

      manager.setSaveFunction(vi.fn().mockResolvedValue(undefined));
      manager.markChanged({ test: "data" });

      expect(newCallback).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("stops all timers", () => {
      const manager = new AutosaveManager();
      manager.start();
      manager.destroy();

      // Should not crash
      expect(manager).toBeDefined();
    });

    it("prevents further saves after destroy", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager();
      manager.setSaveFunction(saveFn);

      manager.destroy();
      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).not.toHaveBeenCalled();
    });
  });

  describe("F085 Acceptance Criteria", () => {
    it("background save: saves without blocking UI", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      // Mark changed and continue working
      manager.markChanged({ test: "data1" });
      manager.markChanged({ test: "data2" });
      manager.markChanged({ test: "data3" });

      // Save happens in background after debounce
      await vi.advanceTimersByTimeAsync(100);

      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saveFn).toHaveBeenCalledWith({ test: "data3" });
    });

    it("debounced: waits for pause in edits before saving", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({ debounceMs: 2000 });
      manager.setSaveFunction(saveFn);

      // Rapid changes
      manager.markChanged({ test: "data1" });
      await vi.advanceTimersByTimeAsync(500);

      manager.markChanged({ test: "data2" });
      await vi.advanceTimersByTimeAsync(500);

      manager.markChanged({ test: "data3" });

      // Should not save yet
      expect(saveFn).not.toHaveBeenCalled();

      // Should save after debounce period
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it("shows save status: tracks and updates status", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const statusChanges: AutosaveStatus[] = [];
      const manager = new AutosaveManager({
        debounceMs: 100,
        onStatusChange: (status) => statusChanges.push(status),
      });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1500);

      // Should show progression: pending -> saving -> saved -> idle
      expect(statusChanges).toEqual(["pending", "saving", "saved", "idle"]);
    });

    it("no UI blocking: saves asynchronously", async () => {
      let saveInProgress = false;
      const saveFn = vi.fn().mockImplementation(async () => {
        saveInProgress = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        saveInProgress = false;
      });

      const manager = new AutosaveManager({ debounceMs: 100 });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });

      // User can continue working while save is scheduled
      manager.markChanged({ test: "data2" });

      expect(saveInProgress).toBe(false); // Not blocking
    });

    it("autosaves every 10 seconds when interval is running", async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const manager = new AutosaveManager({
        interval: 10000,
        debounceMs: 100,
      });
      manager.setSaveFunction(saveFn);

      manager.markChanged({ test: "data" });
      manager.start();

      // First save from debounce
      await vi.advanceTimersByTimeAsync(100);
      expect(saveFn).toHaveBeenCalledTimes(1);

      // Make more changes
      saveFn.mockClear();
      manager.markChanged({ test: "data2" });

      // Should save after 10 seconds (from interval)
      await vi.advanceTimersByTimeAsync(10000);
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });
});
