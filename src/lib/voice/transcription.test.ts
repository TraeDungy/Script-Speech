/**
 * Tests for voice transcription
 * F001: Basic voice-to-text transcription
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WebSpeechProvider,
  TranscriptionManager,
  createTranscriptionManager,
  isTranscriptionSupported,
  getSupportedLanguages,
  type TranscriptionCallbacks,
} from "./transcription";
import type { VoiceTranscriptionResult } from "./types";

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  lang = "en-US";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

  start() {
    if (this.onstart) {
      // Call immediately for synchronous testing
      this.onstart();
    }
  }

  stop() {
    if (this.onend) {
      // Call immediately for synchronous testing
      this.onend();
    }
  }

  // Test helpers
  simulateResult(text: string, confidence: number, isFinal: boolean) {
    if (this.onresult) {
      const event = {
        resultIndex: 0,
        results: [
          {
            0: { transcript: text, confidence },
            isFinal,
            length: 1,
            item: () => ({ transcript: text, confidence }),
            [Symbol.iterator]: function* () {
              yield { transcript: text, confidence };
            },
          },
        ],
      } as unknown as SpeechRecognitionEvent;
      this.onresult(event);
    }
  }

  simulateError(errorCode: string) {
    if (this.onerror) {
      const event = {
        error: errorCode,
      } as SpeechRecognitionErrorEvent;
      this.onerror(event);
    }
  }
}

describe("WebSpeechProvider", () => {
  let mockRecognitionInstance: MockSpeechRecognition;
  let mockStream: MediaStream;

  beforeEach(() => {
    // Create a mock instance that will be reused
    mockRecognitionInstance = new MockSpeechRecognition();

    // Mock the SpeechRecognition constructor to return our instance
    (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition = vi.fn(() => mockRecognitionInstance) as unknown as typeof SpeechRecognition;

    // Mock MediaStream
    mockStream = {
      getTracks: () => [
        {
          stop: vi.fn(),
          kind: "audio",
          enabled: true,
          id: "test-track",
        },
      ],
    } as unknown as MediaStream;
  });

  afterEach(() => {
    delete (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;
  });

  it("should create a Web Speech provider", () => {
    const provider = new WebSpeechProvider();
    expect(provider).toBeDefined();
    expect(provider.isActive()).toBe(false);
  });

  it("should start transcription with default config", async () => {
    const callbacks: TranscriptionCallbacks = {
      onStart: vi.fn(),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    expect(provider.isActive()).toBe(true);
    expect(callbacks.onStart).toHaveBeenCalled();
  });

  it("should start transcription with custom config", async () => {
    const provider = new WebSpeechProvider();
    await provider.start(mockStream, {
      language: "es-ES",
      continuous: false,
      interimResults: false,
      maxAlternatives: 3,
    });

    const config = provider.getConfig();
    expect(config.language).toBe("es-ES");
    expect(config.continuous).toBe(false);
    expect(config.interimResults).toBe(false);
    expect(config.maxAlternatives).toBe(3);
  });

  it("should process transcription results", async () => {
    const results: VoiceTranscriptionResult[] = [];
    const callbacks: TranscriptionCallbacks = {
      onResult: (result) => results.push(result),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    // Simulate interim result
    mockRecognitionInstance.simulateResult("Hello", 0.9, false);

    expect(results.length).toBe(1);
    expect(results[0].text).toBe("Hello");
    expect(results[0].confidence).toBe(0.9);
    expect(results[0].isFinal).toBe(false);
    expect(results[0].language).toBe("en-US");
    expect(results[0].timestamp).toBeGreaterThan(0);
  });

  it("should process final transcription results", async () => {
    const results: VoiceTranscriptionResult[] = [];
    const callbacks: TranscriptionCallbacks = {
      onResult: (result) => results.push(result),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    // Simulate final result
    mockRecognitionInstance.simulateResult("Hello world", 0.95, true);

    expect(results.length).toBe(1);
    expect(results[0].text).toBe("Hello world");
    expect(results[0].confidence).toBe(0.95);
    expect(results[0].isFinal).toBe(true);
  });

  it("should handle multiple results", async () => {
    const results: VoiceTranscriptionResult[] = [];
    const callbacks: TranscriptionCallbacks = {
      onResult: (result) => results.push(result),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    // Simulate multiple results
    mockRecognitionInstance.simulateResult("Hello", 0.8, false);
    mockRecognitionInstance.simulateResult("Hello world", 0.9, false);
    mockRecognitionInstance.simulateResult("Hello world!", 0.95, true);

    expect(results.length).toBe(3);
    expect(results[0].isFinal).toBe(false);
    expect(results[1].isFinal).toBe(false);
    expect(results[2].isFinal).toBe(true);
  });

  it("should stop transcription", async () => {
    const callbacks: TranscriptionCallbacks = {
      onEnd: vi.fn(),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    expect(provider.isActive()).toBe(true);

    provider.stop();

    expect(provider.isActive()).toBe(false);
    expect(callbacks.onEnd).toHaveBeenCalled();
  });

  it("should handle errors", async () => {
    const errors: Array<{ code: string; message: string; fatal: boolean }> = [];
    const callbacks: TranscriptionCallbacks = {
      onError: (error) => errors.push(error),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    // Simulate error
    mockRecognitionInstance.simulateError("no-speech");

    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe("no-speech");
    expect(errors[0].message).toContain("No speech was detected");
    expect(errors[0].fatal).toBe(false);
  });

  it("should identify fatal errors", async () => {
    const errors: Array<{ code: string; message: string; fatal: boolean }> = [];
    const callbacks: TranscriptionCallbacks = {
      onError: (error) => errors.push(error),
    };

    const provider = new WebSpeechProvider(callbacks);
    await provider.start(mockStream);

    // Simulate fatal error
    mockRecognitionInstance.simulateError("not-allowed");

    expect(errors.length).toBe(1);
    expect(errors[0].fatal).toBe(true);
    expect(provider.isActive()).toBe(false);
  });

  it("should update config", async () => {
    const provider = new WebSpeechProvider();
    await provider.start(mockStream);

    provider.updateConfig({
      language: "fr-FR",
      continuous: false,
    });

    const config = provider.getConfig();
    expect(config.language).toBe("fr-FR");
    expect(config.continuous).toBe(false);
  });

  it("should throw if already active", async () => {
    const provider = new WebSpeechProvider();
    await provider.start(mockStream);

    await expect(provider.start(mockStream)).rejects.toThrow("already active");
  });

  it("should throw if speech recognition not supported", async () => {
    delete (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;

    const provider = new WebSpeechProvider();
    await expect(provider.start(mockStream)).rejects.toThrow("not supported");
  });
});

describe("TranscriptionManager", () => {
  let mockRecognitionInstance: MockSpeechRecognition;
  let mockStream: MediaStream;
  let stopTrack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRecognitionInstance = new MockSpeechRecognition();
    (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition = vi.fn(() => mockRecognitionInstance) as unknown as typeof SpeechRecognition;

    stopTrack = vi.fn();
    mockStream = {
      getTracks: () => [
        {
          stop: stopTrack,
          kind: "audio",
          enabled: true,
          id: "test-track",
        },
      ],
    } as unknown as MediaStream;
  });

  afterEach(() => {
    delete (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;
  });

  it("should create a transcription manager", () => {
    const manager = new TranscriptionManager();
    expect(manager).toBeDefined();
    expect(manager.isActive()).toBe(false);
  });

  it("should start transcription", async () => {
    const manager = new TranscriptionManager();
    await manager.start(mockStream);

    expect(manager.isActive()).toBe(true);
    expect(manager.getStream()).toBe(mockStream);
  });

  it("should stop transcription and stream", async () => {
    const manager = new TranscriptionManager();
    await manager.start(mockStream);

    manager.stop();

    expect(manager.isActive()).toBe(false);
    expect(manager.getStream()).toBe(null);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("should update configuration", async () => {
    const manager = new TranscriptionManager();
    await manager.start(mockStream);

    manager.updateConfig({ language: "de-DE" });

    const config = manager.getConfig();
    expect(config.language).toBe("de-DE");
  });

  it("should pass callbacks to provider", async () => {
    const onStart = vi.fn();
    const manager = new TranscriptionManager({ onStart });

    await manager.start(mockStream);

    expect(onStart).toHaveBeenCalled();
  });
});

describe("createTranscriptionManager", () => {
  let mockRecognitionInstance: MockSpeechRecognition;

  beforeEach(() => {
    mockRecognitionInstance = new MockSpeechRecognition();
    (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition = vi.fn(() => mockRecognitionInstance) as unknown as typeof SpeechRecognition;
  });

  afterEach(() => {
    delete (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;
  });

  it("should create a manager instance", () => {
    const manager = createTranscriptionManager();
    expect(manager).toBeInstanceOf(TranscriptionManager);
  });

  it("should create a manager with callbacks", () => {
    const onStart = vi.fn();
    const manager = createTranscriptionManager({ onStart });
    expect(manager).toBeInstanceOf(TranscriptionManager);
  });
});

describe("isTranscriptionSupported", () => {
  it("should return true when SpeechRecognition is available", () => {
    (global as Window & { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition;
    expect(isTranscriptionSupported()).toBe(true);
  });

  it("should return true when webkitSpeechRecognition is available", () => {
    (global as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = MockSpeechRecognition;
    expect(isTranscriptionSupported()).toBe(true);
  });

  it("should return false when speech recognition is not available", () => {
    delete (global as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (global as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    expect(isTranscriptionSupported()).toBe(false);
  });
});

describe("getSupportedLanguages", () => {
  it("should return list of supported languages", () => {
    const languages = getSupportedLanguages();
    expect(languages.length).toBeGreaterThan(0);
    expect(languages[0]).toHaveProperty("code");
    expect(languages[0]).toHaveProperty("name");
  });

  it("should include common languages", () => {
    const languages = getSupportedLanguages();
    const codes = languages.map((lang) => lang.code);

    expect(codes).toContain("en-US");
    expect(codes).toContain("es-ES");
    expect(codes).toContain("fr-FR");
    expect(codes).toContain("de-DE");
  });
});

describe("Performance", () => {
  let mockRecognitionInstance: MockSpeechRecognition;

  beforeEach(() => {
    mockRecognitionInstance = new MockSpeechRecognition();
    (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition = vi.fn(() => mockRecognitionInstance) as unknown as typeof SpeechRecognition;
  });

  afterEach(() => {
    delete (global as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;
  });

  it("should process results with low latency", async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn(), kind: "audio", enabled: true, id: "test" }],
    } as unknown as MediaStream;

    const results: VoiceTranscriptionResult[] = [];
    const latencies: number[] = [];

    const manager = new TranscriptionManager({
      onResult: (result) => {
        const latency = Date.now() - result.timestamp;
        latencies.push(latency);
        results.push(result);
      },
    });

    await manager.start(mockStream);

    // Simulate multiple rapid results
    for (let i = 0; i < 10; i++) {
      mockRecognitionInstance.simulateResult(`Test ${i}`, 0.9, false);
    }

    // All latencies should be very low (< 300ms as per acceptance criteria)
    // In practice, they'll be near 0ms since we're simulating
    latencies.forEach((latency) => {
      expect(latency).toBeLessThan(300);
    });
  });

  it("should handle rapid start/stop cycles", async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn(), kind: "audio", enabled: true, id: "test" }],
    } as unknown as MediaStream;

    const manager = new TranscriptionManager();

    for (let i = 0; i < 5; i++) {
      await manager.start(mockStream);
      expect(manager.isActive()).toBe(true);
      manager.stop();
      expect(manager.isActive()).toBe(false);
    }
  });
});
