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
    }
  | { type: "tool-error"; invocation: ToolInvocationMessage; error: Error };

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

  if (payload.projectStatePatch && isPlainObject(payload.projectStatePatch)) {
    metadata.projectStatePatch = payload.projectStatePatch as OrchestratorSessionMetadata["projectStatePatch"];
  }

  if (typeof payload.projectStatePatchReason === "string") {
    metadata.projectStatePatchReason = payload.projectStatePatchReason;
  }

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
  private requestedSessionId?: string;

  private session: RealtimeSession | null = null;
  private connection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSenders = new Set<RTCRtpSender>();
  private remoteAudioElement: HTMLMediaElement | null = null;
  private remoteAudioStream: MediaStream | null = null;
  private sessionMetadata: OrchestratorSessionMetadata | null = null;
  private pendingToolRequests = new Map<string, ToolInvocationMessage>();
  private isRecovering = false;
  private manualDisconnect = false;

  // Audio processing via data channel (new architecture)
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioSourceNode: MediaStreamAudioSourceNode | null = null;
  private audioPlaybackQueue: AudioBuffer[] = [];
  private isPlayingAudio = false;

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
    this.manualDisconnect = false;
    this.session = session;
    this.sessionMetadata = metadata;
    this.events.emit({ type: "session-metadata", metadata });
    if (metadata?.sessionId) {
      this.requestedSessionId = metadata.sessionId;
    }

    const connection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.connection = connection;
    connection.addEventListener("connectionstatechange", () => {
      const state = connection.connectionState;
      this.events.emit({ type: "connection-state", state });

      if ((state === "failed" || state === "disconnected") && !this.manualDisconnect) {
        void this.recoverConnection();
        return;
      }

      if (state === "closed") {
        if (!this.isRecovering) {
          this.disconnect();
        }
        return;
      }

      if (state === "failed" || state === "disconnected") {
        this.disconnect();
      }
    });

    connection.addEventListener("track", (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteAudioStream = stream;
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = stream;
          // Try to play audio, but don't throw if autoplay is blocked by browser
          this.remoteAudioElement.play?.().catch(() => {
            // Autoplay blocked - audio will play after user interaction (e.g., clicking mic button)
          });
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

      // Debug logging for all data channel messages
      if (typeof payload === "object" && payload !== null && "type" in payload) {
        const msgType = payload.type;

        // Always log message type
        console.log("[Realtime] Message type:", msgType);

        // Log full payload for important messages
        if (typeof msgType === "string" &&
            (msgType.includes("function") ||
             msgType.includes("tool") ||
             msgType.includes("response") ||
             msgType.includes("conversation") ||
             msgType.includes("input_audio")||
             msgType.includes("transcript"))) {
          console.log("[Realtime] Full payload:", JSON.stringify(payload, null, 2));
        }
      } else {
        console.log("[Realtime] Data channel message:", payload);
      }

      const acknowledgement = parseToolAcknowledgement(payload);
      if (acknowledgement) {
        console.log("[Realtime] Tool acknowledgement received:", acknowledgement);
        this.resolveToolAcknowledgement(acknowledgement);
        return;
      }

      const invocation = parseToolInvocationPayload(payload);
      if (invocation) {
        console.log("[Realtime] Tool invocation received:", invocation);
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

      // Handle OpenAI Realtime *native* function calls. The API emits completed
      // function calls as `response.output_item.done` with an item of
      // type "function_call" (name + call_id + arguments JSON string). These are
      // NOT the internal `tool.invocation` format parsed above, so bridge them
      // into the same tool-invocation pipeline that populates the canvas.
      if (typeof payload === "object" && payload !== null && "type" in payload) {
        const msgType = (payload as { type?: unknown }).type;

        if (msgType === "response.output_item.done") {
          const item = (payload as { item?: unknown }).item;
          if (
            isPlainObject(item) &&
            item.type === "function_call" &&
            typeof item.name === "string" &&
            typeof item.call_id === "string"
          ) {
            let parsedArgs: unknown = {};
            if (typeof item.arguments === "string" && item.arguments.trim()) {
              try {
                parsedArgs = JSON.parse(item.arguments);
              } catch {
                parsedArgs = {};
              }
            }

            const fnInvocation: ToolInvocationMessage = {
              callId: item.call_id,
              name: item.name,
              arguments: parsedArgs,
            };
            if (this.sessionMetadata?.sessionId) {
              fnInvocation.sessionId = this.sessionMetadata.sessionId;
            }
            if (this.sessionMetadata?.projectId) {
              fnInvocation.projectId = this.sessionMetadata.projectId;
            }

            console.log("[Realtime] Native function call received:", fnInvocation);
            this.events.emit({ type: "tool-invocation", invocation: fnInvocation });
            void this.handleToolInvocation(fnInvocation);
            return;
          }
        }
      }

      // Handle incoming audio from OpenAI (response.audio.delta events)
      if (typeof payload === "object" && payload !== null && "type" in payload) {
        const msgType = payload.type;

        if (msgType === "response.audio.delta" || msgType === "audio.delta") {
          // OpenAI sends audio as base64-encoded PCM16
          const audioData = (payload as { delta?: string }).delta;
          if (typeof audioData === "string") {
            void this.handleIncomingAudio(audioData);
          }
          return;
        }
      }

      this.events.emit({ type: "realtime-event", payload, raw: event.data });
    });

    dataChannel.addEventListener("error", (event) => {
      const error = event.error instanceof Error ? event.error : new Error("Data channel error");
      this.events.emit({ type: "error", error });
    });

    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        const sender = connection.addTrack(track, this.microphoneStream);
        this.microphoneSenders.add(sender);
      }
    }

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

  disconnect(options?: {
    preserveMetadata?: boolean;
    preserveMicrophone?: boolean;
    preserveAudioElement?: boolean;
    manual?: boolean;
  }) {
    this.manualDisconnect = options?.manual ?? true;

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
    if (!options?.preserveMetadata) {
      this.sessionMetadata = null;
      this.pendingToolRequests.clear();
    }

    // Stop microphone and cleanup audio processing
    if (!options?.preserveMicrophone) {
      this.stopMicrophone();
    }

    // Cleanup AudioContext
    if (!options?.preserveMicrophone && this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    // Clear audio playback queue
    this.audioPlaybackQueue = [];
    this.isPlayingAudio = false;

    if (!options?.preserveAudioElement && this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    this.remoteAudioStream = null;
  }

  attachRemoteAudioElement(element: HTMLMediaElement) {
    this.remoteAudioElement = element;
    this.remoteAudioElement.autoplay = true;
    // playsInline is a video-element property; set it defensively for elements
    // that support it (harmless for <audio>) without tripping the media type.
    (this.remoteAudioElement as Partial<HTMLVideoElement>).playsInline = true;

    if (this.remoteAudioStream) {
      this.remoteAudioElement.srcObject = this.remoteAudioStream;
      // Try to play audio, but don't throw if autoplay is blocked by browser
      this.remoteAudioElement.play?.().catch(() => {
        // Autoplay blocked - audio will play after user interaction (e.g., clicking mic button)
      });
    }
  }

  async startMicrophone() {
    if (!this.connection) {
      throw new Error("Realtime connection has not been established yet");
    }

    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("Data channel not open - cannot send audio");
    }

    if (this.microphoneStream && this.audioWorkletNode) {
      return this.microphoneStream;
    }

    console.log("[Realtime] Starting microphone with AudioWorklet pipeline...");

    // Get microphone stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.microphoneStream = stream;

    // Initialize AudioContext
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      console.log("[Realtime] AudioContext created, sample rate:", this.audioContext.sampleRate);
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    try {
      // Load AudioWorklet module
      await this.audioContext.audioWorklet.addModule("/audio-processor.js");
      console.log("[Realtime] AudioWorklet module loaded successfully");

      // Create AudioWorklet node
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        "realtime-audio-processor"
      );

      // Handle audio chunks from AudioWorklet
      this.audioWorkletNode.port.onmessage = (event) => {
        const { type, audio } = event.data;

        if (type === "audio-chunk" && audio instanceof Int16Array) {
          // Convert PCM16 to base64
          const base64Audio = this.pcm16ToBase64(audio);

          // Send via data channel to OpenAI
          this.sendAudioToOpenAI(base64Audio);
        }
      };

      // Connect microphone → AudioWorklet
      this.audioSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.audioSourceNode.connect(this.audioWorkletNode);

      console.log("[Realtime] Audio pipeline connected: Microphone → AudioWorklet → Data Channel");
    } catch (error) {
      console.error("[Realtime] Failed to setup AudioWorklet:", error);
      throw new Error(`AudioWorklet setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return stream;
  }

  stopMicrophone() {
    console.log("[Realtime] Stopping microphone...");

    // Disconnect AudioWorklet
    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch {
        // Ignore if already disconnected
      }
      this.audioSourceNode = null;
    }

    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.disconnect();
      } catch {
        // Ignore if already disconnected
      }
      this.audioWorkletNode = null;
    }

    // Stop microphone tracks
    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        track.stop();
      }
    }

    this.microphoneStream = null;
    console.log("[Realtime] Microphone stopped");
  }

  getSessionMetadata(): OrchestratorSessionMetadata | null {
    return this.sessionMetadata;
  }

  async hydrateSessionMetadata(limit = 200): Promise<OrchestratorSessionMetadata | null> {
    const metadata = this.sessionMetadata;
    if (!metadata?.sessionId) {
      throw new Error("Realtime session has not been established yet");
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "transcript.fetch",
        sessionId: metadata.sessionId,
        limit,
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
          : `Failed to hydrate session metadata: ${response.statusText}`;
      throw new Error(message);
    }

    const transcripts = Array.isArray((payload as Record<string, unknown>)?.transcripts)
      ? ((payload as { transcripts: unknown[] }).transcripts
          .map(parseTranscriptTurn)
          .filter((turn): turn is TranscriptTurnDTO => Boolean(turn)))
      : [];

    const hydrated: OrchestratorSessionMetadata = {
      ...(this.sessionMetadata ?? metadata),
      transcripts,
    };

    this.sessionMetadata = hydrated;
    this.events.emit({ type: "session-metadata", metadata: hydrated });
    return hydrated;
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

      // CRITICAL FIX: Send function result back to OpenAI via data channel
      // OpenAI Realtime API requires function_call_output to complete the tool cycle
      if (this.dataChannel && this.dataChannel.readyState === "open") {
        const functionOutput = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: invocation.callId,
            output: JSON.stringify({
              status: acknowledgement.status,
              result: acknowledgement.projectStatePatch || acknowledgement.transcriptTurn || { success: true },
            }),
          },
        };

        console.log("[Realtime] Sending function result back to OpenAI:", functionOutput);
        this.dataChannel.send(JSON.stringify(functionOutput));
      } else {
        console.warn("[Realtime] Data channel not open, cannot send function result to OpenAI");
      }

      return acknowledgement;
    } catch (error) {
      this.pendingToolRequests.delete(invocation.callId);
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit({ type: "tool-error", invocation, error: err });

      // Send error result back to OpenAI
      if (this.dataChannel && this.dataChannel.readyState === "open") {
        const errorOutput = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: invocation.callId,
            output: JSON.stringify({
              status: "error",
              error: err.message,
            }),
          },
        };

        console.log("[Realtime] Sending error result back to OpenAI:", errorOutput);
        this.dataChannel.send(JSON.stringify(errorOutput));
      }

      throw err;
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
      this.events.emit({ type: "tool-error", invocation, error: err });
    }
  }

  private async recoverConnection() {
    if (this.isRecovering || this.manualDisconnect) {
      return;
    }

    const metadata = this.sessionMetadata;
    if (!metadata?.sessionId) {
      this.disconnect();
      return;
    }

    this.isRecovering = true;
    try {
      const preserveMicrophone = Boolean(this.microphoneStream);
      this.disconnect({
        preserveMetadata: true,
        preserveMicrophone,
        preserveAudioElement: true,
        manual: false,
      });

      this.requestedSessionId = metadata.sessionId;
      const { metadata: refreshed } = await this.connect();

      if (!refreshed && this.sessionMetadata) {
        this.sessionMetadata = {
          ...this.sessionMetadata,
          transcripts: metadata.transcripts ?? this.sessionMetadata.transcripts,
        };
        this.events.emit({ type: "session-metadata", metadata: this.sessionMetadata });
        try {
          await this.hydrateSessionMetadata();
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.events.emit({ type: "error", error: err });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit({ type: "error", error: err });
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Convert PCM16 audio (Int16Array) to base64 string
   */
  private pcm16ToBase64(pcm16: Int16Array): string {
    // Convert Int16Array to Uint8Array (little-endian)
    const uint8Array = new Uint8Array(pcm16.buffer);

    // Convert to base64 using browser's btoa
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to PCM16 audio (Int16Array)
   */
  private base64ToPCM16(base64: string): Int16Array {
    // Decode base64 to binary string
    const binary = atob(base64);

    // Convert to Uint8Array
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }

    // Create Int16Array view of the buffer
    return new Int16Array(uint8Array.buffer);
  }

  /**
   * Send audio chunk to OpenAI via data channel
   */
  private sendAudioToOpenAI(base64Audio: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      console.warn("[Realtime] Data channel not open, cannot send audio");
      return;
    }

    const audioEvent = {
      type: "input_audio_buffer.append",
      audio: base64Audio,
    };

    try {
      this.dataChannel.send(JSON.stringify(audioEvent));
      // Log periodically (every 50 chunks = ~10 seconds at 200ms chunks)
      if (Math.random() < 0.02) {
        console.log("[Realtime] Sending audio to OpenAI (sampling log)");
      }
    } catch (error) {
      console.error("[Realtime] Failed to send audio chunk:", error);
    }
  }

  /**
   * Handle incoming audio from OpenAI (response.audio.delta events)
   */
  private async handleIncomingAudio(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      console.warn("[Realtime] AudioContext not initialized, cannot play audio");
      return;
    }

    try {
      // Decode base64 to PCM16
      const pcm16 = this.base64ToPCM16(base64Audio);

      // Convert PCM16 to Float32 for Web Audio API
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
      }

      // Create AudioBuffer (24kHz mono from OpenAI)
      const audioBuffer = this.audioContext.createBuffer(
        1, // mono
        float32.length,
        24000 // OpenAI sends 24kHz audio
      );

      // Copy data to AudioBuffer
      audioBuffer.copyToChannel(float32, 0);

      // Add to playback queue
      this.audioPlaybackQueue.push(audioBuffer);

      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        void this.playAudioQueue();
      }
    } catch (error) {
      console.error("[Realtime] Failed to process incoming audio:", error);
    }
  }

  /**
   * Play queued audio buffers continuously without gaps
   */
  private async playAudioQueue(): Promise<void> {
    if (!this.audioContext || this.isPlayingAudio) {
      return;
    }

    this.isPlayingAudio = true;

    while (this.audioPlaybackQueue.length > 0) {
      const audioBuffer = this.audioPlaybackQueue.shift();
      if (!audioBuffer) continue;

      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Play audio
      source.start();

      // Wait for audio to finish playing
      const duration = audioBuffer.duration * 1000; // Convert to ms
      await new Promise(resolve => setTimeout(resolve, duration));
    }

    this.isPlayingAudio = false;
  }
}

export function createRealtimeClient(options?: RealtimeClientOptions) {
  return new RealtimeClient(options);
}
