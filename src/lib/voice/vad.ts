/**
 * Voice Activity Detection (VAD)
 * F002: Voice activity detection
 *
 * Detects when a user is speaking using Web Audio API analysis.
 * - Detects speech start within 100ms
 * - Handles pauses up to 2s
 * - Minimizes false positives
 */

import type { VoiceActivityDetection } from "./types";

export interface VADConfig {
  /**
   * Minimum volume level to consider as speech (0-255)
   * Default: 30
   */
  volumeThreshold?: number;

  /**
   * Number of consecutive frames above threshold to start speech
   * Default: 3 (approximately 60ms at 512 sample size)
   */
  startFrameCount?: number;

  /**
   * Number of consecutive frames below threshold to stop speech
   * Default: 100 (approximately 2s at 512 sample size)
   */
  stopFrameCount?: number;

  /**
   * FFT size for analysis (must be power of 2)
   * Default: 512
   */
  fftSize?: number;

  /**
   * Smoothing time constant for analyzer
   * Default: 0.8
   */
  smoothingTimeConstant?: number;

  /**
   * Sample rate for audio context
   * Default: 16000
   */
  sampleRate?: number;
}

export interface VADCallbacks {
  /**
   * Called when speech starts
   */
  onSpeechStart?: () => void;

  /**
   * Called when speech ends
   */
  onSpeechEnd?: () => void;

  /**
   * Called on each analysis frame with current state
   */
  onVolumeChange?: (volume: number) => void;
}

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;

  private isSpeaking = false;
  private consecutiveVoiceFrames = 0;
  private consecutiveSilenceFrames = 0;

  private config: Required<VADConfig>;
  private callbacks: VADCallbacks;

  constructor(config: VADConfig = {}, callbacks: VADCallbacks = {}) {
    this.config = {
      volumeThreshold: config.volumeThreshold ?? 30,
      startFrameCount: config.startFrameCount ?? 3,
      stopFrameCount: config.stopFrameCount ?? 100,
      fftSize: config.fftSize ?? 512,
      smoothingTimeConstant: config.smoothingTimeConstant ?? 0.8,
      sampleRate: config.sampleRate ?? 16000,
    };

    this.callbacks = callbacks;
  }

  /**
   * Start voice activity detection with the given media stream
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.audioContext) {
      throw new Error("VAD is already running");
    }

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext is not supported in this browser");
      }

      this.audioContext = new AudioContextClass({ sampleRate: this.config.sampleRate });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      // Initialize data array
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Start analysis loop
      this.analyze();
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop voice activity detection
   */
  stop(): void {
    this.cleanup();
  }

  /**
   * Get current voice activity state
   */
  getState(): VoiceActivityDetection {
    const volume = this.getCurrentVolume();
    return {
      isSpeaking: this.isSpeaking,
      volume,
      confidence: this.calculateConfidence(volume),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Main analysis loop
   */
  private analyze = (): void => {
    if (!this.analyser || !this.dataArray) {
      return;
    }

    // Get current volume
    this.analyser.getByteTimeDomainData(this.dataArray);
    const volume = this.getCurrentVolume();

    // Notify volume change
    if (this.callbacks.onVolumeChange) {
      this.callbacks.onVolumeChange(volume);
    }

    // Check if volume exceeds threshold
    const isVoiceDetected = volume > this.config.volumeThreshold;

    if (isVoiceDetected) {
      this.consecutiveVoiceFrames++;
      this.consecutiveSilenceFrames = 0;

      // Start speech if we've had enough consecutive voice frames
      if (!this.isSpeaking && this.consecutiveVoiceFrames >= this.config.startFrameCount) {
        this.isSpeaking = true;
        if (this.callbacks.onSpeechStart) {
          this.callbacks.onSpeechStart();
        }
      }
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveVoiceFrames = 0;

      // End speech if we've had enough consecutive silence frames
      if (this.isSpeaking && this.consecutiveSilenceFrames >= this.config.stopFrameCount) {
        this.isSpeaking = false;
        if (this.callbacks.onSpeechEnd) {
          this.callbacks.onSpeechEnd();
        }
      }
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.analyze);
  };

  /**
   * Calculate current volume level
   */
  private getCurrentVolume(): number {
    if (!this.dataArray) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const value = this.dataArray[i] - 128; // Center around 0
      sum += value * value; // Square for RMS calculation
    }

    const rms = Math.sqrt(sum / this.dataArray.length);
    return Math.round(rms);
  }

  /**
   * Calculate confidence score for current voice detection
   */
  private calculateConfidence(volume: number): number {
    if (volume <= this.config.volumeThreshold) {
      return 0;
    }

    // Confidence increases with volume above threshold
    const excessVolume = volume - this.config.volumeThreshold;
    const maxExcess = 255 - this.config.volumeThreshold;
    const rawConfidence = Math.min(excessVolume / maxExcess, 1);

    // Factor in consecutive frames for more stable confidence
    let frameBonus = 0;
    if (this.isSpeaking) {
      frameBonus = Math.min(this.consecutiveVoiceFrames / this.config.startFrameCount, 1) * 0.2;
    }

    return Math.min(rawConfidence + frameBonus, 1);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.dataArray = null;
    this.isSpeaking = false;
    this.consecutiveVoiceFrames = 0;
    this.consecutiveSilenceFrames = 0;
  }
}

/**
 * Create a simple voice activity detector
 */
export function createVAD(config?: VADConfig, callbacks?: VADCallbacks): VoiceActivityDetector {
  return new VoiceActivityDetector(config, callbacks);
}
