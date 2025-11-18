"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRealtimeClient, type RealtimeClientEvent } from "@/lib/realtime";
import type { OrchestratorSessionMetadata, TranscriptTurnDTO } from "@/lib/realtime/schema";
import type { ScriptDocTranscriptEntry } from "@/lib/scriptDoc";
import { useScriptDocStore } from "@/lib/state/scriptDocStore";

type TranscriptMessage = {
  id: string;
  role: string;
  canonicalRole: string;
  text: string;
  final: boolean;
  updatedAt: number;
};

const MAX_MESSAGES = 20;

function formatRole(role?: string) {
  if (!role) {
    return "Script Speech";
  }

  const normalized = role.toLowerCase();
  if (normalized === "user") {
    return "Director";
  }

  if (normalized === "assistant") {
    return "Script Speech";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function extractTextFromContent(content: unknown): string {
  if (!content) {
    return "";
  }

  const fragments: string[] = [];

  const visit = (value: unknown) => {
    if (!value) {
      return;
    }

    if (typeof value === "string") {
      fragments.push(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }

    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (key === "text" || key === "transcript" || key === "value") {
          if (typeof entry === "string") {
            fragments.push(entry);
          } else if (Array.isArray(entry)) {
            for (const nested of entry) {
              if (typeof nested === "string") {
                fragments.push(nested);
              }
            }
          }
        } else if (key === "content" || key === "delta" || key === "output" || key === "outputs") {
          visit(entry);
        }
      }
    }
  };

  visit(content);
  return fragments.join("");
}

function transcriptToMessage(turn: TranscriptTurnDTO): TranscriptMessage {
  return {
    id: turn.id,
    role: formatRole(turn.role),
    canonicalRole: turn.role,
    text: turn.text,
    final: turn.final,
    updatedAt: new Date(turn.createdAt).getTime(),
  };
}

function transcriptToStoreEntry(turn: TranscriptTurnDTO): ScriptDocTranscriptEntry {
  return {
    id: turn.id,
    role: turn.role,
    text: turn.text,
    final: turn.final,
    createdAt: turn.createdAt,
  };
}

function messageToStoreEntry(message: TranscriptMessage): ScriptDocTranscriptEntry {
  return {
    id: message.id,
    role: message.canonicalRole,
    text: message.text,
    final: message.final,
    createdAt: new Date(message.updatedAt).toISOString(),
  };
}

function transcriptEntryToMessage(entry: ScriptDocTranscriptEntry): TranscriptMessage {
  return {
    id: entry.id,
    role: formatRole(entry.role),
    canonicalRole: entry.role,
    text: entry.text,
    final: entry.final,
    updatedAt: new Date(entry.createdAt).getTime(),
  };
}

export function VoiceChatPanel() {
  const projectId = useScriptDocStore((state) => state.doc.metadata.projectId);
  const appendTranscriptTurn = useScriptDocStore((state) => state.appendTranscriptTurn);
  const loadTranscriptLog = useScriptDocStore((state) => state.loadTranscriptLog);
  const applyScriptDocPatch = useScriptDocStore((state) => state.applyPatch);

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isMicActive, setIsMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sessionMetadataRef = useRef<OrchestratorSessionMetadata | null>(null);
  const persistedMessagesRef = useRef(new Set<string>());
  const clientRef = useRef(createRealtimeClient({ projectId }));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }

    return;
  }, []);

  const ingestTranscriptTurn = useCallback(
    (turn: TranscriptTurnDTO) => {
      const message = transcriptToMessage(turn);
      setMessages((previous) => {
        const next = [...previous];
        const index = next.findIndex((entry) => entry.id === message.id);
        const now = Date.now();
        if (index >= 0) {
          next[index] = {
            ...next[index],
            role: message.role,
            canonicalRole: message.canonicalRole,
            text: message.text,
            final: message.final,
            updatedAt: now,
          };
        } else {
          next.push({ ...message, updatedAt: now });
        }

        if (next.length > MAX_MESSAGES) {
          return next.slice(-MAX_MESSAGES);
        }

        return next;
      });

      persistedMessagesRef.current.add(message.id);
      appendTranscriptTurn(transcriptToStoreEntry(turn));
    },
    [appendTranscriptTurn],
  );

  const processPayload = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return;
      }

      const data = payload as Record<string, unknown>;
      const type = typeof data.type === "string" ? data.type : undefined;
      if (!type) {
        return;
      }

      const updateMessage = (
        id: string | undefined,
        role: string | undefined,
        text: string | undefined,
        final: boolean | undefined,
        append: boolean,
      ) => {
        if (!id) {
          return;
        }

        setMessages((previous) => {
          const next = [...previous];
          const index = next.findIndex((message) => message.id === id);
          const resolvedRole = role ? formatRole(role) : undefined;
          const canonicalRole = role ?? (index >= 0 ? next[index].canonicalRole : "assistant");
          const trimmedText = text?.trim();

          if (index >= 0) {
            const existing = next[index];
            const newText =
              normalizedText !== undefined
                ? append
                  ? `${existing.text}${normalizedText}`
                  : normalizedText
                : existing.text;

            next[index] = {
              ...existing,
              role: resolvedRole ?? existing.role,
              canonicalRole,
              text: newText,
              final: final ?? existing.final,
              updatedAt: Date.now(),
            };
          } else if (typeof normalizedText === "string" && normalizedText.length > 0) {
            next.push({
              id,
              role: resolvedRole ?? formatRole(role),
              canonicalRole,
              text: trimmedText,
              final: Boolean(final),
              updatedAt: Date.now(),
            });
          }

          if (next.length > MAX_MESSAGES) {
            return next.slice(-MAX_MESSAGES);
          }

          return next;
        });
      };

      if (type === "conversation.item.created") {
        const item = data.item as Record<string, unknown> | undefined;
        const text = extractTextFromContent(item?.content);
        if (text) {
          updateMessage(item?.id as string | undefined, item?.role as string | undefined, text, item?.status === "completed", false);
        }
        return;
      }

      if (type === "conversation.item.delta") {
        const delta = data.delta as Record<string, unknown> | undefined;
        const text = extractTextFromContent(delta?.content ?? delta);
        if (text) {
          updateMessage(data.item_id as string | undefined, (delta?.role ?? data.role) as string | undefined, text, delta?.status === "completed", true);
        }
        return;
      }

      if (type === "conversation.item.completed") {
        updateMessage(data.item_id as string | undefined, undefined, undefined, true, false);
        return;
      }

      if (type === "response.delta") {
        const response = data.response as Record<string, unknown> | undefined;
        const delta = data.delta as Record<string, unknown> | undefined;
        const text = extractTextFromContent(delta?.content ?? delta?.output ?? delta);
        if (text) {
          updateMessage(
            (response?.id ?? data.id) as string | undefined,
            (delta?.role ?? response?.role ?? data.role) as string | undefined,
            text,
            false,
            true,
          );
        }
        return;
      }

      if (type === "response.completed") {
        const response = data.response as Record<string, unknown> | undefined;
        const text = extractTextFromContent(response?.output ?? response?.outputs ?? response);
        if (text) {
          updateMessage(response?.id as string | undefined, response?.role as string | undefined, text, true, false);
        }
        return;
      }

      if (type === "response.output_text.delta") {
        const text = extractTextFromContent(data.delta ?? data.text ?? data);
        if (text) {
          updateMessage(data.response_id as string | undefined, data.role as string | undefined, text, false, true);
        }
        return;
      }

      if (type === "response.output_text.done") {
        updateMessage(data.response_id as string | undefined, data.role as string | undefined, undefined, true, false);
        return;
      }
    },
    [setMessages],
  );

  useEffect(() => {
    const client = clientRef.current;

    if (audioRef.current) {
      client.attachRemoteAudioElement(audioRef.current);
    }

    const unsubscribe = client.events.subscribe((event: RealtimeClientEvent) => {
      if (event.type === "connection-state") {
        setConnectionState(event.state);
        if (event.state === "failed" || event.state === "disconnected" || event.state === "closed") {
          setIsMicActive(false);
        }
        return;
      }

      if (event.type === "error") {
        setError(event.error.message);
        return;
      }

      if (event.type === "tool-error") {
        setError(event.error.message);
        console.warn("Realtime tool error", event.error);
        return;
      }

      if (event.type === "session-metadata") {
        const previousSessionId = sessionMetadataRef.current?.sessionId;
        sessionMetadataRef.current = event.metadata ?? null;

        if (!event.metadata) {
          return;
        }

        if (event.metadata.projectStatePatch) {
          applyScriptDocPatch(event.metadata.projectStatePatch);
        }

        if (!previousSessionId || previousSessionId !== event.metadata.sessionId) {
          persistedMessagesRef.current.clear();
        }

        if (event.metadata.transcripts?.length) {
          const sorted = [...event.metadata.transcripts].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          setMessages(sorted.map(transcriptToMessage));
          for (const turn of sorted) {
            persistedMessagesRef.current.add(turn.id);
          }
          loadTranscriptLog(sorted.map(transcriptToStoreEntry));
        } else if (!previousSessionId || previousSessionId !== event.metadata.sessionId) {
          setMessages([]);
          loadTranscriptLog([]);
        }

        return;
      }

      if (event.type === "tool-acknowledged") {
        if (event.acknowledgement.projectStatePatch) {
          applyScriptDocPatch(event.acknowledgement.projectStatePatch);
        }

        if (event.acknowledgement.transcriptTurn) {
          ingestTranscriptTurn(event.acknowledgement.transcriptTurn);
        }

        return;
      }

      if (event.type === "realtime-event") {
        setError(null);
        processPayload(event.payload);
      }
    });

    setConnectionState("connecting");
    client
      .connect()
      .then(() => {
        if (audioRef.current) {
          client.attachRemoteAudioElement(audioRef.current);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to connect to realtime session");
        setConnectionState("failed");
      });

    return () => {
      unsubscribe();
      client.stopMicrophone();
      client.disconnect();
      setIsMicActive(false);
      sessionMetadataRef.current = null;
      persistedMessagesRef.current.clear();
    };
  }, [applyScriptDocPatch, ingestTranscriptTurn, loadTranscriptLog, processPayload]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.updatedAt - b.updatedAt);
  }, [messages]);

  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      loadTranscriptLog([]);
      persistedMessagesRef.current.clear();
      return;
    }

    setMessages([]);
    loadTranscriptLog([]);
    persistedMessagesRef.current.clear();

    let cancelled = false;

    async function loadPersistedNotes() {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/notes`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const entries = Array.isArray(payload?.entries) ? (payload.entries as ScriptDocTranscriptEntry[]) : [];
        if (!entries.length || cancelled) {
          return;
        }
        setMessages(entries.map(transcriptEntryToMessage));
        loadTranscriptLog(entries);
        entries.forEach((entry) => persistedMessagesRef.current.add(entry.id));
      } catch (err) {
        console.warn("Failed to load stored transcripts", err);
      }
    }

    loadPersistedNotes();

    return () => {
      cancelled = true;
    };
  }, [loadTranscriptLog, projectId]);

  useEffect(() => {
    const metadata = sessionMetadataRef.current;
    if (!metadata?.ackToken || !metadata.sessionId) {
      return;
    }

    const finalMessages = messages.filter((message) => message.final && !persistedMessagesRef.current.has(message.id));
    if (!finalMessages.length) {
      return;
    }

    for (const message of finalMessages) {
      persistedMessagesRef.current.add(message.id);
      void (async () => {
        try {
          const response = await fetch("/api/realtime/orchestrator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "transcript.append",
              sessionId: metadata.sessionId,
              ackToken: metadata.ackToken,
              projectId: metadata.projectId ?? projectId,
              turn: {
                id: message.id,
                role: message.canonicalRole,
                text: message.text,
                final: message.final,
                createdAt: new Date(message.updatedAt).toISOString(),
              },
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            persistedMessagesRef.current.delete(message.id);
            console.warn("Failed to persist transcript turn", payload?.error ?? response.statusText);
            return;
          }

          if (payload?.acknowledgement?.transcriptTurn) {
            appendTranscriptTurn(transcriptToStoreEntry(payload.acknowledgement.transcriptTurn as TranscriptTurnDTO));
          } else {
            appendTranscriptTurn(messageToStoreEntry(message));
          }
        } catch (err) {
          persistedMessagesRef.current.delete(message.id);
          console.warn("Transcript persistence error", err);
        }
      })();
    }
  }, [appendTranscriptTurn, messages, projectId]);

  const statusLabel = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return "Live";
      case "connecting":
      case "new":
        return "Connecting";
      case "failed":
      case "disconnected":
      case "closed":
        return "Offline";
      default:
        return "Offline";
    }
  }, [connectionState]);

  const handleMicToggle = useCallback(async () => {
    const client = clientRef.current;

    if (isMicActive) {
      client.stopMicrophone();
      setIsMicActive(false);
      return;
    }

    try {
      await client.startMicrophone();
      setIsMicActive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access was denied");
      setIsMicActive(false);
    }
  }, [isMicActive]);

  const micDisabled = !isMicActive && connectionState !== "connected";
  const listItemMotion = prefersReducedMotion ? "" : " transition-transform duration-300 hover:-translate-y-0.5";
  const hoverMotion = prefersReducedMotion ? "" : " transition-colors duration-300";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500">
        <span>Voice chat</span>
        <span className={statusLabel === "Live" ? "text-emerald-400" : "text-zinc-500"}>{statusLabel}</span>
      </div>
      <ul className="mt-6 space-y-5">
        {sortedMessages.length === 0 ? (
          <li className={`rounded-2xl border border-dashed border-white/10 bg-vs-panel/40 p-4 text-sm text-zinc-400${hoverMotion}`}>
            <p>Connect your microphone to start capturing directives for the Script Speech agents.</p>
          </li>
        ) : (
          sortedMessages.map((message) => (
            <li
              key={message.id}
              className={`space-y-2 rounded-2xl border border-white/10 bg-vs-panel p-4${listItemMotion}`}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{message.role}</p>
              <p className="text-sm text-zinc-300">{message.text}</p>
            </li>
          ))
        )}
      </ul>
      <button
        type="button"
        onClick={handleMicToggle}
        disabled={micDisabled}
        className={`mt-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-vs-panel px-4 py-3 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60${hoverMotion} ${
          isMicActive ? "border-emerald-400/40 text-white" : ""
        }`}
      >
        <span>{isMicActive ? "Stop microphone" : "Start microphone"}</span>
        <span className={`h-2 w-2 rounded-full ${isMicActive ? "bg-emerald-400" : "bg-zinc-500"}`} aria-hidden="true" />
      </button>
      {error ? <p className="mt-4 text-xs text-rose-300">{error}</p> : null}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
