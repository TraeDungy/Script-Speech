/**
 * Tests for microphone permission handling
 * F003: Microphone permission handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkMicrophonePermission,
  requestMicrophonePermission,
  getAudioInputDevices,
  checkVoiceSupport,
  watchMicrophonePermission,
} from "./permissions";

describe("Microphone Permission Handling (F003)", () => {
  // Store original navigator
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe("checkMicrophonePermission", () => {
    it("should return unknown state when permissions API is not available", async () => {
      // Mock navigator without permissions API
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const result = await checkMicrophonePermission();

      expect(result.state).toBe("unknown");
      expect(result.error).toBeDefined();
    });

    it("should return granted state when permission is granted", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ state: "granted" });

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
        },
        writable: true,
        configurable: true,
      });

      const result = await checkMicrophonePermission();

      expect(result.state).toBe("granted");
      expect(mockQuery).toHaveBeenCalledWith({ name: "microphone" });
    });

    it("should return denied state when permission is denied", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ state: "denied" });

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
        },
        writable: true,
        configurable: true,
      });

      const result = await checkMicrophonePermission();

      expect(result.state).toBe("denied");
    });

    it("should return prompt state when permission is prompt", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ state: "prompt" });

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
        },
        writable: true,
        configurable: true,
      });

      const result = await checkMicrophonePermission();

      expect(result.state).toBe("prompt");
    });

    it("should fallback to enumerateDevices when permissions.query fails", async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error("Not supported"));
      const mockEnumerateDevices = vi.fn().mockResolvedValue([{ kind: "audioinput", deviceId: "mic1" }]);

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
          mediaDevices: { enumerateDevices: mockEnumerateDevices },
        },
        writable: true,
        configurable: true,
      });

      const result = await checkMicrophonePermission();

      expect(result.state).toBe("prompt");
      expect(mockEnumerateDevices).toHaveBeenCalled();
    });
  });

  describe("requestMicrophonePermission", () => {
    it("should return unknown state when media devices API is not available", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("unknown");
      expect(result.error).toContain("Media devices API not available");
    });

    it("should return granted state when permission is granted", async () => {
      const mockStop = vi.fn();
      const mockGetTracks = vi.fn().mockReturnValue([{ stop: mockStop }]);
      const mockGetUserMedia = vi.fn().mockResolvedValue({ getTracks: mockGetTracks });

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("granted");
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
      expect(mockStop).toHaveBeenCalled();
    });

    it("should return denied state with specific message when user denies permission", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("denied");
      expect(result.error).toContain("denied by the user");
    });

    it("should return denied state when no microphone is found", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException("No device found", "NotFoundError"));

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("denied");
      expect(result.error).toContain("No microphone was found");
    });

    it("should return denied state when microphone is already in use", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException("Device in use", "NotReadableError"));

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("denied");
      expect(result.error).toContain("already in use");
    });

    it("should return denied state on insecure context", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException("Insecure context", "SecurityError"));

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestMicrophonePermission();

      expect(result.state).toBe("denied");
      expect(result.error).toContain("not allowed on this page");
    });
  });

  describe("getAudioInputDevices", () => {
    it("should return empty array when media devices API is not available", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const devices = await getAudioInputDevices();

      expect(devices).toEqual([]);
    });

    it("should return list of audio input devices", async () => {
      const mockDevices = [
        { kind: "audioinput", deviceId: "mic1", label: "Built-in Microphone", groupId: "group1" },
        { kind: "videoinput", deviceId: "cam1", label: "Camera", groupId: "group2" },
        { kind: "audioinput", deviceId: "mic2", label: "USB Microphone", groupId: "group3" },
      ];

      const mockEnumerateDevices = vi.fn().mockResolvedValue(mockDevices);

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { enumerateDevices: mockEnumerateDevices },
        },
        writable: true,
        configurable: true,
      });

      const devices = await getAudioInputDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].deviceId).toBe("mic1");
      expect(devices[0].label).toBe("Built-in Microphone");
      expect(devices[1].deviceId).toBe("mic2");
    });

    it("should provide default label when device label is empty", async () => {
      const mockDevices = [{ kind: "audioinput", deviceId: "mic1", label: "", groupId: "group1" }];

      const mockEnumerateDevices = vi.fn().mockResolvedValue(mockDevices);

      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { enumerateDevices: mockEnumerateDevices },
        },
        writable: true,
        configurable: true,
      });

      const devices = await getAudioInputDevices();

      expect(devices[0].label).toContain("Microphone");
    });
  });

  describe("checkVoiceSupport", () => {
    it("should return false when getUserMedia is not available", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const support = checkVoiceSupport();

      expect(support.supported).toBe(false);
      expect(support.features.getUserMedia).toBe(false);
    });

    it("should return true when all required features are available", () => {
      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: vi.fn() },
          permissions: {},
        },
        writable: true,
        configurable: true,
      });

      // Mock AudioContext
      (global as unknown as { AudioContext: unknown }).AudioContext = class {};

      const support = checkVoiceSupport();

      expect(support.supported).toBe(true);
      expect(support.features.getUserMedia).toBe(true);
      expect(support.features.audioContext).toBe(true);
    });

    it("should check for webkit prefixed AudioContext", () => {
      Object.defineProperty(global, "navigator", {
        value: {
          mediaDevices: { getUserMedia: vi.fn() },
        },
        writable: true,
        configurable: true,
      });

      // Mock webkitAudioContext
      Object.defineProperty(global.window, "webkitAudioContext", {
        value: class {},
        writable: true,
        configurable: true,
      });

      const support = checkVoiceSupport();

      expect(support.features.audioContext).toBe(true);
    });
  });

  describe("watchMicrophonePermission", () => {
    it("should call callback when permission state changes", async () => {
      const mockCallback = vi.fn();
      const listeners = new Map<string, EventListener>();

      const mockStatus = {
        state: "granted",
        addEventListener: vi.fn((event: string, listener: EventListener) => {
          listeners.set(event, listener);
        }),
        removeEventListener: vi.fn((event: string) => {
          listeners.delete(event);
        }),
      };

      const mockQuery = vi.fn().mockResolvedValue(mockStatus);

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
        },
        writable: true,
        configurable: true,
      });

      const unwatch = watchMicrophonePermission(mockCallback);

      // Wait for query to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockCallback).toHaveBeenCalledWith("granted");

      // Simulate permission change
      mockStatus.state = "denied";
      const changeListener = listeners.get("change");
      if (changeListener) {
        changeListener(new Event("change"));
      }

      expect(mockCallback).toHaveBeenCalledWith("denied");

      // Cleanup
      unwatch();
      expect(mockStatus.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("should call callback with unknown when permissions API fails", async () => {
      const mockCallback = vi.fn();
      const mockQuery = vi.fn().mockRejectedValue(new Error("Not supported"));

      Object.defineProperty(global, "navigator", {
        value: {
          permissions: { query: mockQuery },
        },
        writable: true,
        configurable: true,
      });

      const unwatch = watchMicrophonePermission(mockCallback);

      // Wait for query to reject
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockCallback).toHaveBeenCalledWith("unknown");

      // Cleanup should not throw
      expect(() => unwatch()).not.toThrow();
    });

    it("should return no-op cleanup function when navigator is not available", () => {
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockCallback = vi.fn();
      const unwatch = watchMicrophonePermission(mockCallback);

      expect(mockCallback).not.toHaveBeenCalled();
      expect(() => unwatch()).not.toThrow();
    });
  });
});
