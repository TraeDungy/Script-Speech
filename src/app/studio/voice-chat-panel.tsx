"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRealtimeClient, type RealtimeClientEvent } from "@/lib/realtime";

type TranscriptMessage = {
  id: string;
  role: string;
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
      const trimmed = value.trim();
      if (trimmed) {
        fragments.push(trimmed);
      }
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
  return fragments.join("").trim();
}

export function VoiceChatPanel() {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isMicActive, setIsMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const clientRef = useRef(createRealtimeClient());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

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
          const trimmedText = text?.trim();

          if (index >= 0) {
            const existing = next[index];
            const newText = trimmedText ? (append ? `${existing.text}${trimmedText}` : trimmedText) : existing.text;

            next[index] = {
              ...existing,
              role: resolvedRole ?? existing.role,
              text: newText,
              final: final ?? existing.final,
              updatedAt: Date.now(),
            };
          } else if (trimmedText) {
            next.push({
              id,
              role: resolvedRole ?? formatRole(role),
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
    };
  }, [processPayload]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.updatedAt - b.updatedAt);
  }, [messages]);

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
