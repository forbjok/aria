import io from "socket.io-client";
import $ from "jquery";

export class Chat {
  activate() {
    this.posts = [];

    var socket = io("http://localhost:8080");

    socket.on("connect", () =>{
      socket.emit("join", "testing");
    });

    socket.on("post", (post) => {
      this.posts.push(post);
    });
  }

  attached() {
    this.postForm = $("#postForm");
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

  post(){
    console.log("pots!");
    var formData = new FormData(this.postForm);

    console.log("Posting jquey");
    $.ajax("http://localhost:8080/testing/post", { data: formData, contentType: false, processData: false }).done(() => {
      console.log("Posted!");
    });
  }
}
