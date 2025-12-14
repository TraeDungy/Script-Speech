/**
 * Voice feature types and interfaces
 */

export type MicrophonePermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface MicrophonePermissionResult {
  state: MicrophonePermissionState;
  error?: string;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId?: string;
}

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  language?: string;
  timestamp: number;
}

export interface VoiceActivityDetection {
  isSpeaking: boolean;
  volume: number;
  confidence: number;
}

export interface TranscriptionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

/**
 * Speaker diarization types
 * F008: Speaker diarization
 */

export interface Speaker {
  id: string;
  label: string;
  confidence: number;
  voiceProfile?: VoiceProfile;
  characterName?: string;
}

export interface VoiceProfile {
  pitch: number;
  tempo: number;
  energy: number;
  embedding?: number[];
}

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  text?: string;
  confidence: number;
}

export interface DiarizationResult {
  speakers: Speaker[];
  segments: SpeakerSegment[];
  activeSpeaker?: string;
  timestamp: number;
}

export interface DiarizationConfig {
  minSpeakers?: number;
  maxSpeakers?: number;
  enableVoiceProfiles?: boolean;
  segmentationThreshold?: number;
}
