import io from "socket.io-client";

export class SocketService {
  constructor() {
    this.socket = io({
      autoConnect: false
    });
  }

  getSocket() {
    return this.socket;
  }
}
