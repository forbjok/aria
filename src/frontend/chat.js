import {inject} from "aurelia-framework";

import io from "socket.io-client";
import $ from "jquery";
import "jquery-cookie";

@inject("RoomName")
export class Chat {
  constructor(roomName) {
    this.roomName = roomName;
    this.postUrl = `/chat/${this.roomName}/post`;

    this.posts = [];
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: $.cookie("post_name"),
      message: ""
    };
  }

  submitPost() {
    var post = this.post;
    var image = post.image;

    if(!post.message && !image)
      return;

    var formData = new FormData();
    formData.append("name", post.name);
    formData.append("message", post.message);

    if (image)
      formData.append("image", image, image.name);

    $.ajax(this.postUrl, {
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

  attached() {
    this.postForm = $("#postForm")[0];
    var postContainer = $("#postContainer");
    var chatControls = $("#chatControls");

    function resize() {
      var chatControlsHeight = chatControls.height();

      postContainer.css("bottom", chatControlsHeight + 4);
    }

    resize();

    $(window).resize(() => {
      resize();
    });

    this.clearPost();

    var socket = io();

    socket.on("post", (post) => {
      this.posts.push(post);
    });

    socket.on("connect", () => {
      this.posts = [];
      socket.emit("join", this.roomName);
    });
  }

  imageSelected(event) {
    this.post.image = event.target.files[0];
  }
}
