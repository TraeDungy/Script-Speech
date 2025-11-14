"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createRealtimeClient, type RealtimeClient } from "@/lib/realtime";
import type {
  OrchestratorSessionMetadata,
  TranscriptTurnDTO,
} from "@/lib/realtime/schema";

const MAX_TRANSCRIPT_TURNS = 200;

type VoicePermissionState = "unknown" | "granted" | "denied";

export interface VoiceCaptureOptions {
  projectId?: string;
  tokenEndpoint?: string;
  sessionId?: string;
}

export interface VoiceCaptureState {
  connectionState: RTCPeerConnectionState;
  metadata: OrchestratorSessionMetadata | null;
  transcripts: TranscriptTurnDTO[];
  isMicrophoneActive: boolean;
  microphonePermission: VoicePermissionState;
  error: string | null;
}

export interface VoiceCaptureControls {
  connect: () => Promise<OrchestratorSessionMetadata | null>;
  disconnect: () => void;
  startMicrophone: () => Promise<MediaStream>;
  stopMicrophone: () => void;
  attachAudioElement: (element: HTMLAudioElement | null) => void;
  resetError: () => void;
}

export type UseVoiceCaptureClientResult = VoiceCaptureState & VoiceCaptureControls;

function sortTranscripts(turns: TranscriptTurnDTO[]): TranscriptTurnDTO[] {
  return [...turns].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function mergeTranscriptTurns(
  existing: TranscriptTurnDTO[],
  updates: TranscriptTurnDTO[] | TranscriptTurnDTO,
): TranscriptTurnDTO[] {
  const next = new Map(existing.map((turn) => [turn.id, turn] as const));
  const entries = Array.isArray(updates) ? updates : [updates];
  for (const turn of entries) {
    if (!turn?.id) {
      continue;
    }
    next.set(turn.id, turn);
  }
  return sortTranscripts(Array.from(next.values())).slice(-MAX_TRANSCRIPT_TURNS);
}

export function useVoiceCaptureClient(
  options?: VoiceCaptureOptions,
): UseVoiceCaptureClientResult {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [metadata, setMetadata] = useState<OrchestratorSessionMetadata | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptTurnDTO[]>([]);
  const [isMicrophoneActive, setMicrophoneActive] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState<VoicePermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  if (!clientRef.current) {
    clientRef.current = createRealtimeClient({
      projectId: options?.projectId,
      sessionId: options?.sessionId,
      tokenEndpoint: options?.tokenEndpoint ?? "/api/realtime/relay",
    });
  }

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      throw new Error("Voice capture client has not been initialised");
    }
    return clientRef.current;
  }, []);

  useEffect(() => {
    const client = getClient();
    const unsubscribe = client.events.subscribe((event) => {
      switch (event.type) {
        case "connection-state":
          setConnectionState(event.state);
          break;
        case "error":
          setError(event.error.message);
          break;
        case "session-metadata":
          setMetadata(event.metadata);
          if (event.metadata?.transcripts?.length) {
            setTranscripts((current) =>
              mergeTranscriptTurns(current, event.metadata?.transcripts ?? []),
            );
          }
          break;
        case "tool-acknowledged":
          if (event.acknowledgement.transcriptTurn) {
            setTranscripts((current) =>
              mergeTranscriptTurns(current, event.acknowledgement.transcriptTurn!),
            );
          }
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [getClient]);

  useEffect(() => {
    return () => {
      const client = clientRef.current;
      if (client) {
        client.stopMicrophone();
        client.disconnect();
      }
      clientRef.current = null;
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const client = getClient();
    const { metadata: nextMetadata } = await client.connect();
    if (nextMetadata) {
      setMetadata(nextMetadata);
      if (nextMetadata.transcripts?.length) {
        setTranscripts((current) => mergeTranscriptTurns(current, nextMetadata.transcripts ?? []));
      }
    }
    return nextMetadata ?? client.getSessionMetadata();
  }, [getClient]);

  const disconnect = useCallback(() => {
    const client = getClient();
    client.disconnect();
    setMetadata(null);
    setTranscripts([]);
    setConnectionState("disconnected");
    setMicrophoneActive(false);
  }, [getClient]);

  const startMicrophone = useCallback(async () => {
    setError(null);
    try {
      const stream = await getClient().startMicrophone();
      setMicrophoneActive(true);
      setMicrophonePermission("granted");
      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        typeof navigator !== "undefined" &&
        "permissions" in navigator &&
        err instanceof DOMException &&
        err.name === "NotAllowedError"
      ) {
        setMicrophonePermission("denied");
      }
      setError(message);
      throw err;
    }
  }, [getClient]);

  const stopMicrophone = useCallback(() => {
    const client = getClient();
    client.stopMicrophone();
    setMicrophoneActive(false);
  }, [getClient]);

  const attachAudioElement = useCallback(
    (element: HTMLAudioElement | null) => {
      audioElementRef.current = element;
      if (!element) {
        return;
      }
      const client = getClient();
      client.attachRemoteAudioElement(element);
    },
    [getClient],
  );

  const resetError = useCallback(() => setError(null), []);

  return {
    connectionState,
    metadata,
    transcripts,
    isMicrophoneActive,
    microphonePermission,
    error,
    connect,
    disconnect,
    startMicrophone,
    stopMicrophone,
    attachAudioElement,
    resetError,
  };
}
