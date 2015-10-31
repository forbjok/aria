import {inject} from "aurelia-framework";

import io from "socket.io-client";
import $ from "jquery";
import "jquery-cookie";
import "jq-ajax-progress";

@inject("RoomName")
export class Chat {
  constructor(roomName) {
    this.roomName = roomName;
    this.postUrl = `/chat/${this.roomName}/post`;

    this.posts = [];
    this.themes = [
      { name: "dark", description: "Dark" },
      { name: "yotsubab", description: "Yotsuba B" }
    ];
    this.theme = $.cookie("theme") || "dark";
    this.postingDisabled = false;
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: $.cookie("post_name"),
      comment: ""
    };
  }

  submitPost() {
    var post = this.post;
    var image = post.image;

    if(!post.comment && !image)
      return;

    var formData = new FormData();
    formData.append("name", post.name);
    formData.append("comment", post.comment);

    if (image)
      formData.append("image", image, image.name);

    // Save name in cookie
    $.cookie("post_name", this.post.name);

    // Disable post controls while posting
    this.postingDisabled = true;

    let ajaxPost = $.ajax(this.postUrl, {
      method: "POST",
      data: formData,
      contentType: false,
      processData: false
    });

    ajaxPost.uploadProgress((e) => {
      if (e.lengthComputable) {
        let percentComplete = parseInt((e.loaded / e.total) * 100);
        this.postingProgress = `${percentComplete}%`;
      } else {
        this.postingProgress = "Posting...";
      }
    });

    ajaxPost.done(() => {
      this.postingProgress = "Done!";
      this.clearPost();
    });

    ajaxPost.always(() => {
      this.postingDisabled = false;

      setTimeout(() => {
        this.postingProgress = "";
      }, 5000);
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

  themeSelected() {
    $.cookie("theme", this.theme);
  }

  toggleImage(post) {
    post.showFullImage = !post.showFullImage;
  }
}
