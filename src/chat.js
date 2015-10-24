import io from "socket.io-client";
import $ from "jquery";

export class Chat {
  activate() {
    this.posts = [];

    var socket = io();

    socket.on("connect", () => {
      socket.emit("join", "testing");
    });

    socket.on("post", (post) => {
      this.posts.push(post);
    });
  }

  attached() {
    this.postForm = $("#postForm")[0];
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

  post() {
    var formData = new FormData(this.postForm);

    $.ajax("/testing/post", {
      method: "POST",
      data: formData,
      contentType: false,
      processData: false
    }).done(() => {
      console.log("Posted!");
    });
  }
}
