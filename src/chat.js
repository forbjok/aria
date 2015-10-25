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
    this.socket = io();
  }

  clearPost() {
    this.postForm.reset();
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

  activate() {
    var socket = this.socket;

    socket.on("post", (post) => {
      this.posts.push(post);
    });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
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

    this.clearPost();
  }
}
