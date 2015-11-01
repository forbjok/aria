import io from "socket.io-client";

var socket = io({
  autoConnect: false
});

export default socket;
