/**
 * Voice-to-text transcription
 * F001: Basic voice-to-text transcription
 *
 * Provides real-time speech-to-text transcription using Web Speech API
 * with fallback structure for cloud providers (Deepgram, AssemblyAI, Whisper)
 */

import type { VoiceTranscriptionResult, TranscriptionConfig } from "./types";

// TypeScript includes Web Speech API types in lib.dom.d.ts

export interface TranscriptionCallbacks {
  /**
   * Called when transcription results are available
   */
  onResult?: (result: VoiceTranscriptionResult) => void;

  /**
   * Called when transcription error occurs
   */
  onError?: (error: TranscriptionError) => void;

  /**
   * Called when transcription starts
   */
  onStart?: () => void;

  /**
   * Called when transcription ends
   */
  onEnd?: () => void;
}

export interface TranscriptionError {
  code: string;
  message: string;
  fatal: boolean;
}

export interface ITranscriptionProvider {
  start(stream: MediaStream, config?: TranscriptionConfig): Promise<void>;
  stop(): void;
  isActive(): boolean;
  getConfig(): TranscriptionConfig;
  updateConfig(config: Partial<TranscriptionConfig>): void;
}

/**
 * Web Speech API transcription provider
 * Uses browser's built-in speech recognition
 */
export class WebSpeechProvider implements ITranscriptionProvider {
  private recognition: unknown | null = null;
  private config: Required<TranscriptionConfig>;
  private callbacks: TranscriptionCallbacks;
  private active = false;

  constructor(callbacks: TranscriptionCallbacks = {}) {
    this.config = {
      language: "en-US",
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
    };
    this.callbacks = callbacks;
  }

  async start(stream: MediaStream, config?: TranscriptionConfig): Promise<void> {
    if (this.active) {
      throw new Error("Transcription is already active");
    }

    // Check browser support
    const SpeechRecognitionClass =
      (window as typeof globalThis & { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as typeof globalThis & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      throw new Error("Speech recognition is not supported in this browser");
    }

    // Apply config
    if (config) {
      Object.assign(this.config, config);
    }

    // Create recognition instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition = new (SpeechRecognitionClass as any)() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).continuous = this.config.continuous;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).interimResults = this.config.interimResults;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).maxAlternatives = this.config.maxAlternatives;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).lang = this.config.language;

    // Set up event handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).onstart = () => {
      this.active = true;
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).onend = () => {
      this.active = false;
      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).onresult = (event: any) => {
      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];

        const transcription: VoiceTranscriptionResult = {
          text: alternative.transcript,
          confidence: alternative.confidence,
          isFinal: result.isFinal,
          language: this.config.language,
          timestamp: Date.now(),
        };

        if (this.callbacks.onResult) {
          this.callbacks.onResult(transcription);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.recognition as any).onerror = (event: any) => {
      const error: TranscriptionError = {
        code: event.error,
        message: this.getErrorMessage(event.error),
        fatal: this.isFatalError(event.error),
      };

      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }

      if (error.fatal) {
        this.active = false;
      }
    };

    // Start recognition
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.recognition as any).start();
    } catch (error) {
      this.active = false;
      throw error;
    }
  }

  stop(): void {
    if (this.recognition && this.active) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.recognition as any).stop();
      this.active = false;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getConfig(): TranscriptionConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<TranscriptionConfig>): void {
    Object.assign(this.config, config);

    // Apply config to recognition if active
    if (this.recognition) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = this.recognition as any;
      if (config.language !== undefined) {
        recognition.lang = config.language;
      }
      if (config.continuous !== undefined) {
        recognition.continuous = config.continuous;
      }
      if (config.interimResults !== undefined) {
        recognition.interimResults = config.interimResults;
      }
      if (config.maxAlternatives !== undefined) {
        recognition.maxAlternatives = config.maxAlternatives;
      }
    }
  }

  private getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      "no-speech": "No speech was detected. Please try again.",
      "audio-capture": "No microphone was found or microphone access failed.",
      "not-allowed": "Microphone permission was denied.",
      "network": "Network error occurred during transcription.",
      "aborted": "Transcription was aborted.",
      "service-not-allowed": "Speech recognition service is not allowed.",
      "bad-grammar": "Grammar error in recognition.",
      "language-not-supported": "Selected language is not supported.",
    };

    return messages[errorCode] || `Transcription error: ${errorCode}`;
  }

  private isFatalError(errorCode: string): boolean {
    const fatalErrors = ["not-allowed", "service-not-allowed", "language-not-supported"];
    return fatalErrors.includes(errorCode);
  }
}

/**
 * Main transcription manager
 * Handles provider selection and lifecycle
 */
export class TranscriptionManager {
  private provider: ITranscriptionProvider;
  private stream: MediaStream | null = null;

  constructor(callbacks: TranscriptionCallbacks = {}) {
    // For now, always use Web Speech API
    // In the future, this can be extended to support cloud providers
    this.provider = new WebSpeechProvider(callbacks);
  }

  /**
   * Start transcription with the given media stream
   */
  async start(stream: MediaStream, config?: TranscriptionConfig): Promise<void> {
    this.stream = stream;
    await this.provider.start(stream, config);
  }

  /**
   * Stop transcription
   */
  stop(): void {
    this.provider.stop();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Check if transcription is active
   */
  isActive(): boolean {
    return this.provider.isActive();
  }

  /**
   * Get current configuration
   */
  getConfig(): TranscriptionConfig {
    return this.provider.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TranscriptionConfig>): void {
    this.provider.updateConfig(config);
  }

  /**
   * Get the media stream being used
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
}

/**
 * Create a transcription manager
 */
export function createTranscriptionManager(callbacks?: TranscriptionCallbacks): TranscriptionManager {
  return new TranscriptionManager(callbacks);
}

/**
 * Check if transcription is supported in the current browser
 */
export function isTranscriptionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ((window as Window & { SpeechRecognition?: unknown }).SpeechRecognition !== undefined ||
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition !== undefined)
  );
}

/**
 * Get list of supported languages for Web Speech API
 * Note: This is a common subset. Actual support varies by browser.
 */
export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  return [
    { code: "en-US", name: "English (US)" },
    { code: "en-GB", name: "English (UK)" },
    { code: "es-ES", name: "Spanish (Spain)" },
    { code: "es-MX", name: "Spanish (Mexico)" },
    { code: "fr-FR", name: "French" },
    { code: "de-DE", name: "German" },
    { code: "it-IT", name: "Italian" },
    { code: "pt-BR", name: "Portuguese (Brazil)" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "ja-JP", name: "Japanese" },
    { code: "ko-KR", name: "Korean" },
    { code: "ru-RU", name: "Russian" },
    { code: "ar-SA", name: "Arabic" },
    { code: "hi-IN", name: "Hindi" },
  ];
}
