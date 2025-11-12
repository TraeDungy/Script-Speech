import {
  parseToolAcknowledgement,
  parseToolInvocationPayload,
  TOOL_DEFINITIONS,
  type OrchestratorSessionMetadata,
  type ToolSchemaDefinition,
  type ToolAcknowledgement,
  type ToolInvocationMessage,
  type TranscriptTurnDTO,
  validateToolInvocationPayload,
} from "./schema";

export interface RealtimeSession {
  url: string;
  client_secret: {
    value: string;
  };
  id?: string;
  expires_at?: string;
}

export interface RealtimeClientOptions {
  /**
   * Endpoint to request session tokens from. Defaults to `/api/realtime/orchestrator`.
   */
  tokenEndpoint?: string;
  /**
   * Optional list of ICE servers to pass into the RTCPeerConnection.
   */
  iceServers?: RTCIceServer[];
  /**
   * Optional project identifier for orchestration metadata.
   */
  projectId?: string;
  /**
   * Optional session identifier to reuse persisted metadata.
   */
  sessionId?: string;
}

export type RealtimeClientEvent =
  | { type: "connection-state"; state: RTCPeerConnectionState }
  | { type: "error"; error: Error }
  | { type: "realtime-event"; payload: unknown; raw: string }
  | { type: "session-metadata"; metadata: OrchestratorSessionMetadata | null }
  | { type: "tool-invocation"; invocation: ToolInvocationMessage }
  | {
      type: "tool-acknowledged";
      invocation: ToolInvocationMessage;
      acknowledgement: ToolAcknowledgement;
    };

type Listener<T> = (event: T) => void;

class SimpleEventEmitter<T> {
  private listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: T) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

function waitForIceGathering(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const listener = () => {
      if (connection.iceGatheringState === "complete") {
        connection.removeEventListener("icegatheringstatechange", listener);
        resolve();
      }
    };

    connection.addEventListener("icegatheringstatechange", listener);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function isRealtimeSession(value: unknown): value is RealtimeSession {
  if (!isPlainObject(value)) {
    return false;
  }

  const url = typeof value.url === "string";
  const secret = isPlainObject(value.client_secret) && typeof value.client_secret.value === "string";
  return url && secret;
}

function parseTranscriptTurn(value: unknown): TranscriptTurnDTO | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : null;
  const role = typeof value.role === "string" ? value.role : null;
  const text = typeof value.text === "string" ? value.text : null;
  const final = typeof value.final === "boolean" ? value.final : null;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : null;

  if (!id || !role || !text || final === null || !createdAt) {
    return null;
  }

  return {
    id,
    role,
    text,
    final,
    createdAt,
    sessionId: typeof value.sessionId === "string" ? value.sessionId : undefined,
    projectId: typeof value.projectId === "string" ? value.projectId : undefined,
  };
}

function parseSessionMetadata(payload: unknown): OrchestratorSessionMetadata | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  const ackToken = typeof payload.ackToken === "string" ? payload.ackToken : null;

  if (!sessionId || !ackToken) {
    return null;
  }

  const toolSchemas: typeof TOOL_DEFINITIONS = [];
  if (Array.isArray(payload.toolSchemas)) {
    for (const entry of payload.toolSchemas) {
      if (!isPlainObject(entry) || typeof entry.name !== "string") {
        continue;
      }

      toolSchemas.push({
        name: entry.name,
        description: typeof entry.description === "string" ? entry.description : undefined,
        schema: (entry.schema ?? {}) as ToolSchemaDefinition["schema"],
      });
    }
  }

  const metadata: OrchestratorSessionMetadata = {
    sessionId,
    ackToken,
    projectId: typeof payload.projectId === "string" ? payload.projectId : undefined,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
    toolSchemas: toolSchemas.length ? toolSchemas : TOOL_DEFINITIONS,
    transcripts: Array.isArray(payload.transcripts)
      ? payload.transcripts
          .map(parseTranscriptTurn)
          .filter((turn): turn is TranscriptTurnDTO => Boolean(turn))
      : [],
  };

  return metadata;
}

class RealtimeConnectionError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RealtimeConnectionError";
  }
}

export class RealtimeClient {
  readonly events = new SimpleEventEmitter<RealtimeClientEvent>();

  private readonly tokenEndpoint: string;
  private readonly iceServers?: RTCIceServer[];
  private readonly projectId?: string;
  private readonly requestedSessionId?: string;

  private session: RealtimeSession | null = null;
  private connection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSenders = new Set<RTCRtpSender>();
  private remoteAudioElement: HTMLMediaElement | null = null;
  private remoteAudioStream: MediaStream | null = null;
  private sessionMetadata: OrchestratorSessionMetadata | null = null;
  private pendingToolRequests = new Map<string, ToolInvocationMessage>();

  constructor(options?: RealtimeClientOptions) {
    this.tokenEndpoint = options?.tokenEndpoint ?? "/api/realtime/orchestrator";
    this.iceServers = options?.iceServers;
    this.projectId = options?.projectId;
    this.requestedSessionId = options?.sessionId;
  }

  async connect(): Promise<{ session: RealtimeSession; metadata: OrchestratorSessionMetadata | null }> {
    if (this.connection) {
      return { session: this.session!, metadata: this.sessionMetadata };
    }

    if (typeof window === "undefined") {
      throw new Error("RealtimeClient can only be used in the browser");
    }

    const { session, metadata } = await this.fetchSession();
    this.session = session;
    this.sessionMetadata = metadata;
    this.events.emit({ type: "session-metadata", metadata });

    const connection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.connection = connection;
    connection.addEventListener("connectionstatechange", () => {
      const state = connection.connectionState;
      this.events.emit({ type: "connection-state", state });

      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.disconnect();
      }
    });

    connection.addEventListener("track", (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteAudioStream = stream;
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = stream;
          void this.remoteAudioElement.play?.();
        }
      }
    });

    const dataChannel = connection.createDataChannel("oai-events");
    this.dataChannel = dataChannel;
    dataChannel.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch {
        // Keep raw payload when JSON parsing fails.
      }

      const acknowledgement = parseToolAcknowledgement(payload);
      if (acknowledgement) {
        this.resolveToolAcknowledgement(acknowledgement);
        return;
      }

      const invocation = parseToolInvocationPayload(payload);
      if (invocation) {
        if (this.sessionMetadata?.sessionId) {
          invocation.sessionId = this.sessionMetadata.sessionId;
        }
        if (this.sessionMetadata?.projectId) {
          invocation.projectId = this.sessionMetadata.projectId;
        }
        this.events.emit({ type: "tool-invocation", invocation });
        void this.handleToolInvocation(invocation);
        return;
      }

      this.events.emit({ type: "realtime-event", payload, raw: event.data });
    });

    dataChannel.addEventListener("error", (event) => {
      const error = event.error instanceof Error ? event.error : new Error("Data channel error");
      this.events.emit({ type: "error", error });
    });

    try {
      const offer = await connection.createOffer({ offerToReceiveAudio: true });
      await connection.setLocalDescription(offer);
      await waitForIceGathering(connection);

      const localDescription = connection.localDescription;
      if (!localDescription?.sdp) {
        throw new Error("Local description missing during negotiation");
      }

      const response = await fetch(session.url, {
        method: "POST",
        body: localDescription.sdp,
        headers: {
          Authorization: `Bearer ${session.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to negotiate session: ${response.statusText}`);
      }

      const answer = await response.text();
      await connection.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit({ type: "error", error: err });
      this.disconnect();
      throw err;
    }
    return { session, metadata };
  }

  disconnect() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // ignore
      }
    }

    this.dataChannel = null;

    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        // ignore
      }
    }

    this.connection = null;
    this.session = null;
    this.sessionMetadata = null;
    this.pendingToolRequests.clear();

    this.stopMicrophone();

    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    this.remoteAudioStream = null;
  }

  attachRemoteAudioElement(element: HTMLMediaElement) {
    this.remoteAudioElement = element;
    this.remoteAudioElement.autoplay = true;
    this.remoteAudioElement.playsInline = true;

    if (this.remoteAudioStream) {
      this.remoteAudioElement.srcObject = this.remoteAudioStream;
      void this.remoteAudioElement.play?.();
    }
  }

  async startMicrophone() {
    if (!this.connection) {
      throw new Error("Realtime connection has not been established yet");
    }

    if (this.microphoneStream) {
      return this.microphoneStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.microphoneStream = stream;

    for (const track of stream.getTracks()) {
      const sender = this.connection.addTrack(track, stream);
      this.microphoneSenders.add(sender);
    }

    return stream;
  }

  stopMicrophone() {
    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        track.stop();
      }
    }

    if (this.connection) {
      for (const sender of this.microphoneSenders) {
        try {
          this.connection.removeTrack(sender);
        } catch {
          // ignore failures when the sender has already been removed
        }
      }
    }

    this.microphoneSenders.clear();
    this.microphoneStream = null;
  }

  getSessionMetadata(): OrchestratorSessionMetadata | null {
    return this.sessionMetadata;
  }

  async sendToolMessage(invocation: ToolInvocationMessage) {
    const metadata = this.sessionMetadata;
    if (!metadata?.sessionId || !metadata.ackToken) {
      throw new Error("Realtime session has not been established yet");
    }

    const validationErrors = validateToolInvocationPayload(invocation);
    if (validationErrors.length > 0) {
      throw new Error(`Tool invocation failed validation: ${validationErrors.join("; ")}`);
    }

    this.pendingToolRequests.set(invocation.callId, invocation);

    try {
      const acknowledgement = await this.dispatchToolInvocation(invocation, metadata);
      this.resolveToolAcknowledgement(acknowledgement);
      return acknowledgement;
    } catch (error) {
      this.pendingToolRequests.delete(invocation.callId);
      throw error;
    }
  }

  private async fetchSession(): Promise<{ session: RealtimeSession; metadata: OrchestratorSessionMetadata | null }> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "session.create",
        projectId: this.projectId,
        sessionId: this.requestedSessionId,
      }),
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : `Unable to fetch realtime session: ${response.statusText}`;
      throw new RealtimeConnectionError(message, response.status);
    }

    if (isRealtimeSession(payload)) {
      return { session: payload, metadata: null };
    }

    if (isPlainObject(payload) && isRealtimeSession(payload.session)) {
      const metadata = parseSessionMetadata(payload.metadata);
      if (!metadata) {
        return { session: payload.session, metadata: null };
      }
      if (!metadata.toolSchemas.length) {
        metadata.toolSchemas = TOOL_DEFINITIONS;
      }
      return { session: payload.session, metadata };
    }

    throw new Error("Realtime session response is missing required fields");
  }

  private async dispatchToolInvocation(
    invocation: ToolInvocationMessage,
    metadata: OrchestratorSessionMetadata,
  ): Promise<ToolAcknowledgement> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "tool.invoke",
        sessionId: metadata.sessionId,
        ackToken: metadata.ackToken,
        projectId: invocation.projectId ?? metadata.projectId ?? this.projectId,
        invocation: {
          type: "tool.invocation",
          call_id: invocation.callId,
          name: invocation.name,
          arguments: invocation.arguments,
        },
      }),
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : `Tool invocation failed (${response.status})`;
      throw new Error(message);
    }

    const acknowledgement =
      parseToolAcknowledgement(isPlainObject(payload) ? payload.acknowledgement ?? payload : payload) ??
      null;

    if (!acknowledgement) {
      throw new Error("Tool acknowledgement payload was invalid");
    }

    if (invocation.projectId && this.sessionMetadata) {
      this.sessionMetadata = { ...this.sessionMetadata, projectId: invocation.projectId };
    }

    return acknowledgement;
  }

  private resolveToolAcknowledgement(acknowledgement: ToolAcknowledgement) {
    const invocation = this.pendingToolRequests.get(acknowledgement.requestId);
    if (acknowledgement.transcriptTurn && this.sessionMetadata) {
      const transcripts = Array.isArray(this.sessionMetadata.transcripts)
        ? [...this.sessionMetadata.transcripts]
        : [];
      const index = transcripts.findIndex((turn) => turn.id === acknowledgement.transcriptTurn?.id);
      if (index >= 0) {
        transcripts[index] = acknowledgement.transcriptTurn;
      } else {
        transcripts.push(acknowledgement.transcriptTurn);
      }
      this.sessionMetadata = { ...this.sessionMetadata, transcripts };
    }

    if (invocation) {
      this.pendingToolRequests.delete(acknowledgement.requestId);
      this.events.emit({ type: "tool-acknowledged", invocation, acknowledgement });
      return;
    }

    // Emit acknowledgement even when the originating invocation isn't tracked (e.g., server push).
    this.events.emit({
      type: "tool-acknowledged",
      invocation: {
        callId: acknowledgement.requestId,
        name: "unknown",
        arguments: {},
      },
      acknowledgement,
    });
  }

  private async handleToolInvocation(invocation: ToolInvocationMessage) {
    try {
      await this.sendToolMessage(invocation);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit({ type: "error", error: err });
    }
  }
}

export function createRealtimeClient(options?: RealtimeClientOptions) {
  return new RealtimeClient(options);
}
