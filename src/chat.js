import io from "socket.io-client";
import $ from "jquery";
import "jquery-cookie";

export class Chat {
  clearPost() {
    this.post = {
      name: $.cookie("post_name"),
      message: "",
      image: null
    };
  }

  submitPost() {
    var post = this.post;
    var image = post.image[0];

    if(!post.message && !image)
      return;

    var formData = new FormData();
    formData.append("name", post.name);
    formData.append("message", post.message);

    if (image)
      formData.append("image", image, image.name);

    $.ajax("/testing/post", {
      method: "POST",
      data: formData,
      contentType: false,
      processData: false
    }).done(() => {
      $.cookie("post_name", this.post.name);
      this.clearPost();
      console.log("Posted!");
    });
  }

  activate() {
    this.posts = [];

    var socket = io();

    socket.on("connect", () => {
      socket.emit("join", "testing");
    });

    socket.on("post", (post) => {
      this.posts.push(post);
    });

    this.clearPost();
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
}
