/**
 * Speaker Diarization
 * F008: Speaker diarization
 *
 * Identifies and labels multiple speakers in audio streams.
 * Uses audio analysis to distinguish between different voices.
 */

import type {
  Speaker,
  SpeakerSegment,
  DiarizationResult,
  DiarizationConfig,
  VoiceProfile,
} from "./types";

export interface DiarizationCallbacks {
  /**
   * Called when a new speaker is detected
   */
  onSpeakerDetected?: (speaker: Speaker) => void;

  /**
   * Called when the active speaker changes
   */
  onActiveSpeakerChange?: (speakerId: string) => void;

  /**
   * Called when a new segment is completed
   */
  onSegmentComplete?: (segment: SpeakerSegment) => void;

  /**
   * Called when diarization results are updated
   */
  onUpdate?: (result: DiarizationResult) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Interface for diarization providers
 */
export interface IDiarizationProvider {
  start(stream: MediaStream, config?: DiarizationConfig): Promise<void>;
  stop(): void;
  isActive(): boolean;
  getSpeakers(): Speaker[];
  getActiveSpeaker(): string | undefined;
  assignSpeakerName(speakerId: string, name: string): void;
}

/**
 * Browser-based speaker diarization using audio analysis
 * Analyzes pitch, tempo, and energy to distinguish speakers
 */
export class BrowserDiarizationProvider implements IDiarizationProvider {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private config: Required<DiarizationConfig>;
  private callbacks: DiarizationCallbacks;
  private active = false;
  private speakers: Map<string, Speaker> = new Map();
  private currentSegment: SpeakerSegment | null = null;
  private segments: SpeakerSegment[] = [];
  private activeSpeaker: string | undefined;
  private analyzerInterval: number | null = null;
  private readonly ANALYSIS_INTERVAL = 100; // ms
  private speakerCounter = 0;

  constructor(callbacks: DiarizationCallbacks = {}) {
    this.config = {
      minSpeakers: 1,
      maxSpeakers: 10,
      enableVoiceProfiles: true,
      segmentationThreshold: 0.3,
    };
    this.callbacks = callbacks;
  }

  async start(stream: MediaStream, config?: DiarizationConfig): Promise<void> {
    if (this.active) {
      throw new Error("Diarization is already active");
    }

    // Apply config
    if (config) {
      Object.assign(this.config, config);
    }

    try {
      // Set up Web Audio API
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();

      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.source.connect(this.analyser);

      this.active = true;

      // Start analysis loop
      this.analyzerInterval = window.setInterval(() => {
        this.analyzeAudio();
      }, this.ANALYSIS_INTERVAL);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      throw err;
    }
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    // Complete current segment
    if (this.currentSegment) {
      this.currentSegment.endTime = Date.now();
      this.segments.push(this.currentSegment);
      if (this.callbacks.onSegmentComplete) {
        this.callbacks.onSegmentComplete(this.currentSegment);
      }
      this.currentSegment = null;
    }

    // Clear interval
    if (this.analyzerInterval !== null) {
      clearInterval(this.analyzerInterval);
      this.analyzerInterval = null;
    }

    // Clean up audio nodes
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.active = false;
    this.activeSpeaker = undefined;
  }

  isActive(): boolean {
    return this.active;
  }

  getSpeakers(): Speaker[] {
    return Array.from(this.speakers.values());
  }

  getActiveSpeaker(): string | undefined {
    return this.activeSpeaker;
  }

  assignSpeakerName(speakerId: string, name: string): void {
    const speaker = this.speakers.get(speakerId);
    if (speaker) {
      speaker.characterName = name;
      speaker.label = name;

      // Update all segments for this speaker
      this.segments.forEach(segment => {
        if (segment.speakerId === speakerId) {
          // Segment update handled by reference
        }
      });

      // Notify update
      this.notifyUpdate();
    }
  }

  /**
   * Analyze audio stream and identify speakers
   */
  private analyzeAudio(): void {
    if (!this.analyser || !this.active) {
      return;
    }

    const profile = this.extractVoiceProfile();

    // Find matching speaker or create new one
    const speakerId = this.identifySpeaker(profile);

    // Check if speaker changed
    if (speakerId !== this.activeSpeaker) {
      // Complete previous segment
      if (this.currentSegment) {
        this.currentSegment.endTime = Date.now();
        this.segments.push(this.currentSegment);
        if (this.callbacks.onSegmentComplete) {
          this.callbacks.onSegmentComplete(this.currentSegment);
        }
      }

      // Start new segment
      this.currentSegment = {
        speakerId,
        startTime: Date.now(),
        endTime: Date.now(),
        confidence: 0.85,
      };

      this.activeSpeaker = speakerId;

      if (this.callbacks.onActiveSpeakerChange) {
        this.callbacks.onActiveSpeakerChange(speakerId);
      }

      this.notifyUpdate();
    } else if (this.currentSegment) {
      // Update current segment end time
      this.currentSegment.endTime = Date.now();
    }
  }

  /**
   * Extract voice profile from current audio
   */
  private extractVoiceProfile(): VoiceProfile {
    if (!this.analyser) {
      return { pitch: 0, tempo: 0, energy: 0 };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(dataArray);
    this.analyser.getByteTimeDomainData(timeData);

    // Calculate pitch (dominant frequency)
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }
    const pitch = maxIndex / bufferLength;

    // Calculate energy (average amplitude)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const energy = sum / bufferLength / 255;

    // Calculate tempo (zero-crossing rate as proxy)
    let crossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] > 128 && timeData[i - 1] <= 128) ||
          (timeData[i] <= 128 && timeData[i - 1] > 128)) {
        crossings++;
      }
    }
    const tempo = crossings / timeData.length;

    return { pitch, tempo, energy };
  }

  /**
   * Identify speaker from voice profile
   */
  private identifySpeaker(profile: VoiceProfile): string {
    // If no speakers yet, create first one
    if (this.speakers.size === 0) {
      return this.createNewSpeaker(profile);
    }

    // Find best matching speaker
    let bestMatch: { id: string; similarity: number } | null = null;

    this.speakers.forEach((speaker, id) => {
      if (!speaker.voiceProfile) return;

      const similarity = this.calculateSimilarity(profile, speaker.voiceProfile);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { id, similarity };
      }
    });

    // If similarity is above threshold, use existing speaker
    if (bestMatch && bestMatch.similarity > (1 - this.config.segmentationThreshold)) {
      return bestMatch.id;
    }

    // Create new speaker if under max
    if (this.speakers.size < this.config.maxSpeakers) {
      return this.createNewSpeaker(profile);
    }

    // Otherwise use best match
    return bestMatch?.id || Array.from(this.speakers.keys())[0] || "";
  }

  /**
   * Calculate similarity between two voice profiles
   */
  private calculateSimilarity(profile1: VoiceProfile, profile2: VoiceProfile): number {
    // Simple Euclidean distance in normalized space
    const pitchDiff = Math.abs(profile1.pitch - profile2.pitch);
    const tempoDiff = Math.abs(profile1.tempo - profile2.tempo);
    const energyDiff = Math.abs(profile1.energy - profile2.energy);

    const distance = Math.sqrt(pitchDiff ** 2 + tempoDiff ** 2 + energyDiff ** 2);
    const maxDistance = Math.sqrt(3); // Max possible distance

    return 1 - (distance / maxDistance);
  }

  /**
   * Create a new speaker with voice profile
   */
  private createNewSpeaker(profile: VoiceProfile): string {
    this.speakerCounter++;
    const id = `speaker_${this.speakerCounter}`;
    const label = `Speaker ${this.speakerCounter}`;

    const speaker: Speaker = {
      id,
      label,
      confidence: 0.85,
      voiceProfile: this.config.enableVoiceProfiles ? profile : undefined,
    };

    this.speakers.set(id, speaker);

    if (this.callbacks.onSpeakerDetected) {
      this.callbacks.onSpeakerDetected(speaker);
    }

    return id;
  }

  /**
   * Notify listeners of diarization update
   */
  private notifyUpdate(): void {
    if (this.callbacks.onUpdate) {
      const result: DiarizationResult = {
        speakers: this.getSpeakers(),
        segments: this.segments,
        activeSpeaker: this.activeSpeaker,
        timestamp: Date.now(),
      };
      this.callbacks.onUpdate(result);
    }
  }
}

/**
 * Diarization manager that handles lifecycle
 */
export class DiarizationManager {
  private provider: IDiarizationProvider;
  private config: DiarizationConfig;

  constructor(
    provider: IDiarizationProvider,
    config: DiarizationConfig = {}
  ) {
    this.provider = provider;
    this.config = config;
  }

  async start(stream: MediaStream): Promise<void> {
    return this.provider.start(stream, this.config);
  }

  stop(): void {
    this.provider.stop();
  }

  isActive(): boolean {
    return this.provider.isActive();
  }

  getSpeakers(): Speaker[] {
    return this.provider.getSpeakers();
  }

  getActiveSpeaker(): string | undefined {
    return this.provider.getActiveSpeaker();
  }

  assignSpeakerName(speakerId: string, name: string): void {
    this.provider.assignSpeakerName(speakerId, name);
  }

  updateConfig(config: Partial<DiarizationConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): DiarizationConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create diarization manager
 */
export function createDiarizationManager(
  callbacks: DiarizationCallbacks = {},
  config: DiarizationConfig = {}
): DiarizationManager {
  const provider = new BrowserDiarizationProvider(callbacks);
  return new DiarizationManager(provider, config);
}

/**
 * Check if diarization is supported in the current browser
 */
export function isDiarizationSupported(): boolean {
  return typeof AudioContext !== "undefined" ||
         typeof (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== "undefined";
}
