import {
  PROTOCOL_VERSION,
  ServerMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from "@inferno/shared";

export type SocketStatus = "connecting" | "open" | "closed";

/**
 * The game WebSocket. Sends `hello` on open, validates incoming messages, and reconnects with
 * backoff. The session cookie travels with the upgrade request, so no token is handled here.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private retry = 0;
  private stopped = false;

  constructor(
    private readonly url: string,
    private readonly onMessage: (msg: ServerMessage) => void,
    private readonly onStatus: (s: SocketStatus) => void,
  ) {}

  connect(): void {
    this.stopped = false;
    this.onStatus("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus("open");
      this.send({ v: PROTOCOL_VERSION, type: "hello", data: {} });
    };
    ws.onmessage = (ev) => {
      const parsed = ServerMessageSchema.safeParse(JSON.parse(String(ev.data)));
      if (parsed.success) this.onMessage(parsed.data);
    };
    ws.onclose = () => {
      this.onStatus("closed");
      if (this.stopped) return;
      const delay = Math.min(10_000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Reconnect now (e.g. after signing in or out, so the server sees the new cookie). */
  reconnect(): void {
    this.retry = 0;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    else this.connect();
  }

  close(): void {
    this.stopped = true;
    this.ws?.close();
  }
}

export function socketUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
}
