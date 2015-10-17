import io from 'socket.io-client';
import $ from "jquery";

export class Chat {
  activate() {
    this.posts = [];

    var socket = io('http://localhost:8080');

    socket.on('post', (post) => {
      this.posts.push(post);
    });
  }

  attached() {
    var postContainer = $("#postContainer");
    var chatControls = $("#chatControls");

    function resize() {
      var chatControlsHeight = chatControls.height();

      postContainer.css("bottom", chatControlsHeight);
    }

    resize();

    $(window).resize(() => {
      resize();
    });
  }
}
