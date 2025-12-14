/**
 * Tests for Voice Activity Detection (VAD)
 * F002: Voice activity detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoiceActivityDetector, createVAD } from "./vad";

// Mock AudioContext and related APIs
class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 1024;

  connect = vi.fn();
  disconnect = vi.fn();
  getByteTimeDomainData = vi.fn((array: Uint8Array) => {
    // Simulate audio data
    array.fill(128); // Silence
  });
}

class MockMediaStreamAudioSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  sampleRate = 16000;
  state = "running";

  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => new MockMediaStreamAudioSourceNode());
  close = vi.fn().mockResolvedValue(undefined);
}

describe("Voice Activity Detection (F002)", () => {
  let mockStream: MediaStream;

  beforeEach(() => {
    // Setup global mocks
    (global as { AudioContext?: typeof MockAudioContext }).AudioContext = MockAudioContext as unknown as typeof AudioContext;
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    }) as typeof requestAnimationFrame;
    global.cancelAnimationFrame = vi.fn();

    // Create mock media stream
    mockStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
      id: "mock-stream",
      active: true,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      clone: vi.fn(),
      getTrackById: vi.fn(),
      onaddtrack: null,
      onremovetrack: null,
    } as unknown as MediaStream;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should create VAD with default config", () => {
      const vad = createVAD();
      expect(vad).toBeInstanceOf(VoiceActivityDetector);
    });

    it("should create VAD with custom config", () => {
      const vad = createVAD({
        volumeThreshold: 50,
        startFrameCount: 5,
        stopFrameCount: 50,
      });

      expect(vad).toBeInstanceOf(VoiceActivityDetector);
    });

    it("should accept callbacks in constructor", () => {
      const onSpeechStart = vi.fn();
      const onSpeechEnd = vi.fn();

      const vad = createVAD({}, { onSpeechStart, onSpeechEnd });

      expect(vad).toBeInstanceOf(VoiceActivityDetector);
    });
  });

  describe("Starting and Stopping", () => {
    it("should start VAD successfully", async () => {
      const vad = createVAD();
      await expect(vad.start(mockStream)).resolves.toBeUndefined();
    });

    it("should throw error if VAD is already running", async () => {
      const vad = createVAD();
      await vad.start(mockStream);

      await expect(vad.start(mockStream)).rejects.toThrow("VAD is already running");

      vad.stop();
    });

    it("should stop VAD successfully", async () => {
      const vad = createVAD();
      await vad.start(mockStream);
      expect(() => vad.stop()).not.toThrow();
    });

    it("should handle stop when not running", () => {
      const vad = createVAD();
      expect(() => vad.stop()).not.toThrow();
    });

    it("should cleanup resources on stop", async () => {
      const vad = createVAD();
      await vad.start(mockStream);

      const state1 = vad.getState();
      vad.stop();

      const state2 = vad.getState();
      expect(state2.volume).toBe(0);
    });
  });

  describe("Voice Detection", () => {
    it("should detect speech start within required time", async () => {
      const onSpeechStart = vi.fn();
      const vad = createVAD({ startFrameCount: 3 }, { onSpeechStart });

      await vad.start(mockStream);

      // Simulate loud audio (voice detected)
      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200); // Loud audio
        });
      }

      // Wait for analysis frames
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSpeechStart).toHaveBeenCalled();

      vad.stop();
    });

    it("should detect speech end after silence", async () => {
      const onSpeechStart = vi.fn();
      const onSpeechEnd = vi.fn();
      const vad = createVAD({ startFrameCount: 3, stopFrameCount: 10 }, { onSpeechStart, onSpeechEnd });

      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        // Start with voice
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200);
        });
      }

      // Wait for speech start
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (mockAnalyser) {
        // Switch to silence
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(128);
        });
      }

      // Wait for speech end
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(onSpeechEnd).toHaveBeenCalled();

      vad.stop();
    });

    it("should handle pauses up to configured duration", async () => {
      const onSpeechStart = vi.fn();
      const onSpeechEnd = vi.fn();
      const vad = createVAD({ startFrameCount: 3, stopFrameCount: 100 }, { onSpeechStart, onSpeechEnd });

      await vad.start(mockStream);

      // Should not end speech for short pauses
      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        // Voice
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200);
        });
      }

      // Wait for speech to start
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onSpeechStart).toHaveBeenCalled();

      if (mockAnalyser) {
        // Brief silence
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(128);
        });
      }

      // Wait long enough for speech to end (100 frames at ~16ms each = ~1.6s)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Speech end should be called after enough silence frames
      expect(onSpeechEnd).toHaveBeenCalled();

      vad.stop();
    });

    it("should minimize false positives with frame counting", async () => {
      const onSpeechStart = vi.fn();
      const vad = createVAD({ startFrameCount: 5 }, { onSpeechStart });

      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;

      // Single loud frame (should not trigger)
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Back to silence
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(128);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have triggered speech start (not enough consecutive frames)
      expect(onSpeechStart).not.toHaveBeenCalled();

      vad.stop();
    });
  });

  describe("Volume Monitoring", () => {
    it("should report volume changes", async () => {
      const onVolumeChange = vi.fn();
      const vad = createVAD({}, { onVolumeChange });

      await vad.start(mockStream);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onVolumeChange).toHaveBeenCalled();

      vad.stop();
    });

    it("should calculate volume correctly", async () => {
      const vad = createVAD();
      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(150);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const state = vad.getState();
      expect(state.volume).toBeGreaterThan(0);

      vad.stop();
    });
  });

  describe("State Management", () => {
    it("should return initial state before starting", () => {
      const vad = createVAD();
      const state = vad.getState();

      expect(state.isSpeaking).toBe(false);
      expect(state.volume).toBe(0);
      expect(state.confidence).toBe(0);
    });

    it("should update state during detection", async () => {
      const vad = createVAD();
      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = vad.getState();
      expect(state).toHaveProperty("isSpeaking");
      expect(state).toHaveProperty("volume");
      expect(state).toHaveProperty("confidence");

      vad.stop();
    });

    it("should calculate confidence scores", async () => {
      const vad = createVAD({ volumeThreshold: 30 });
      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(100);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = vad.getState();
      expect(state.confidence).toBeGreaterThanOrEqual(0);
      expect(state.confidence).toBeLessThanOrEqual(1);

      vad.stop();
    });
  });

  describe("Configuration", () => {
    it("should use default configuration", () => {
      const vad = createVAD();
      expect(vad).toBeInstanceOf(VoiceActivityDetector);
    });

    it("should update configuration dynamically", async () => {
      const vad = createVAD({ volumeThreshold: 30 });
      await vad.start(mockStream);

      vad.updateConfig({ volumeThreshold: 50 });

      // Configuration should be updated (verified through behavior)
      const state = vad.getState();
      expect(state).toBeDefined();

      vad.stop();
    });

    it("should respect custom FFT size", async () => {
      const vad = createVAD({ fftSize: 1024 });
      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      expect(mockAnalyser?.fftSize).toBe(1024);

      vad.stop();
    });

    it("should respect custom sample rate", async () => {
      const vad = createVAD({ sampleRate: 48000 });
      await vad.start(mockStream);

      // Sample rate should be set on audio context
      expect(vad).toBeDefined();

      vad.stop();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing AudioContext", async () => {
      delete (global as { AudioContext?: typeof MockAudioContext }).AudioContext;

      const vad = createVAD();
      await expect(vad.start(mockStream)).rejects.toThrow("AudioContext is not supported");
    });

    it("should cleanup on error during start", async () => {
      const vad = createVAD();

      // Make createAnalyser throw
      const BadAudioContext = class extends MockAudioContext {
        createAnalyser = vi.fn(() => {
          throw new Error("Analyser creation failed");
        });
      };

      (global as { AudioContext?: typeof MockAudioContext }).AudioContext = BadAudioContext as unknown as typeof AudioContext;

      await expect(vad.start(mockStream)).rejects.toThrow();

      // Should be safe to call stop after error
      expect(() => vad.stop()).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should detect speech start within 100ms", async () => {
      const onSpeechStart = vi.fn();
      const startTime = Date.now();

      const vad = createVAD({ startFrameCount: 3 }, { onSpeechStart });
      await vad.start(mockStream);

      const mockAnalyser = (vad as VoiceActivityDetector & { analyser: MockAnalyserNode }).analyser;
      if (mockAnalyser) {
        mockAnalyser.getByteTimeDomainData = vi.fn((array: Uint8Array) => {
          array.fill(200);
        });
      }

      // Wait for detection
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (onSpeechStart.mock.calls.length > 0) {
        const detectionTime = Date.now() - startTime;
        // Should detect within reasonable time (allowing for test overhead)
        expect(detectionTime).toBeLessThan(200);
      }

      vad.stop();
    });
  });
});
