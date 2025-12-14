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
