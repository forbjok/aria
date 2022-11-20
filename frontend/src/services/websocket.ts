export interface Message<T> {
  msg: string;
  data: T;
}

export class AriaWebSocket {
  public latency = 0;

  private is_connected = false;
  private ws?: WebSocket;
  private ping_interval?: number;
  private listeners: AriaWsListener[] = [];

  constructor(private url: string, private onopen: (() => void) | null) {}

  public send<T>(msg: string, data?: T) {
    const _data = data ? JSON.stringify(data) : "";
    this.ws?.send(`${msg}|${_data}`);
  }

  public create_listener(): AriaWsListener {
    const listener = new AriaWsListener(this);
    this.listeners.push(listener);

    return listener;
  }

  public remove_listener(listener: AriaWsListener) {
    const ix = this.listeners.findIndex((l) => l == listener);
    if (!ix) {
      return;
    }

    this.listeners.splice(ix, 1);
  }

  public connect() {
    this.is_connected = true;
    this.try_connect();
  }

  public disconnect() {
    this.is_connected = false;

    this.ws?.close();
  }

  private try_connect() {
    clearInterval(this.ping_interval);

    if (!this.is_connected) {
      return;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      console.log("Connected to server.");

      this.onopen?.();

      this.ping_interval = setInterval(() => {
        this.send("ping", getTimestamp());
      }, 30000);
    };

    ws.onclose = () => {
      if (!this.is_connected) {
        return;
      }

      console.log("Disconnected from server. Trying to reconnect.");
      setTimeout(() => this.try_connect(), 5000);
    };

    ws.onmessage = (ev) => {
      const msg = parseMsg(ev.data);

      if (msg.msg === "pong") {
        const now = getTimestamp();
        const ts = msg.data as number;

        this.latency = (now - ts) / 1000;
        return;
      }

      for (const listener of this.listeners) {
        listener.incoming(msg);
      }
    };
  }
}

type HandlerFn<T> = (data: T) => void;

export class AriaWsListener {
  private handlers: { [key: string]: HandlerFn<any> } = {};

  constructor(private ws: AriaWebSocket) {}

  public on<T>(msg: string, handler: HandlerFn<T>) {
    this.handlers[msg] = handler;
  }

  public incoming(msg: Message<any>) {
    const handler = this.handlers[msg.msg];
    if (!handler) {
      return;
    }

    handler(msg.data);
  }

  public dispose() {
    this.ws.remove_listener(this);
  }
}

function parseMsg<T>(msg: string): Message<T> {
  const parts = msg.split("|", 2);
  const data = JSON.parse(parts[1]);

  return { msg: parts[0], data };
}

function getTimestamp(): number {
  return new Date().getTime();
}
