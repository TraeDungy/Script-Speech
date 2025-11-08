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
   * Endpoint to request session tokens from. Defaults to `/api/realtime/session`.
   */
  tokenEndpoint?: string;
  /**
   * Optional list of ICE servers to pass into the RTCPeerConnection.
   */
  iceServers?: RTCIceServer[];
}

export type RealtimeClientEvent =
  | { type: "connection-state"; state: RTCPeerConnectionState }
  | { type: "error"; error: Error }
  | { type: "realtime-event"; payload: unknown; raw: string };

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

export class RealtimeClient {
  readonly events = new SimpleEventEmitter<RealtimeClientEvent>();

  private readonly tokenEndpoint: string;
  private readonly iceServers?: RTCIceServer[];

  private session: RealtimeSession | null = null;
  private connection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSenders = new Set<RTCRtpSender>();
  private remoteAudioElement: HTMLMediaElement | null = null;
  private remoteAudioStream: MediaStream | null = null;

  constructor(options?: RealtimeClientOptions) {
    this.tokenEndpoint = options?.tokenEndpoint ?? "/api/realtime/session";
    this.iceServers = options?.iceServers;
  }

  async connect() {
    if (this.connection) {
      return;
    }

    if (typeof window === "undefined") {
      throw new Error("RealtimeClient can only be used in the browser");
    }

    const session = await this.fetchSession();
    this.session = session;

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
      this.events.emit({ type: "error", error: error instanceof Error ? error : new Error(String(error)) });
      this.disconnect();
      throw error;
    }
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

  private async fetchSession(): Promise<RealtimeSession> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch realtime session: ${response.statusText}`);
    }

    const session = (await response.json()) as RealtimeSession;
    if (!session?.url || !session?.client_secret?.value) {
      throw new Error("Realtime session response is missing required fields");
    }

    return session;
  }
}

export function createRealtimeClient(options?: RealtimeClientOptions) {
  return new RealtimeClient(options);
}
