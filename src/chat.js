import io from 'socket.io-client';

export class Chat {
  constructor() {
    this.init();
  }

  init() {
    this.posts = [];

    var socket = io('http://localhost:8080');

    socket.on('post', (post) => {
      console.log("psot", post);
      this.posts.push(post);
    });
  }
}
