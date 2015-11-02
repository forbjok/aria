import io from "socket.io-client";

let socket = io({
  autoConnect: false
});

export default socket;
