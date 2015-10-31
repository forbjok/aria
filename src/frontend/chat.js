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
    this.postingCooldown = 0;
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: $.cookie("post_name"),
      comment: ""
    };
  }

  submitPost() {
    // Prevent duplicate submits
    if (this.postingDisabled)
      return;

    var post = this.post;
    var image = post.image;

    if(!post.comment && !image)
      return;

    if(this.postingCooldown > 0) {
      this.submitOnCooldown = !this.submitOnCooldown;
      return;
    }

    var formData = new FormData();
    formData.append("name", post.name);
    formData.append("comment", post.comment);

    if (image)
      formData.append("image", image, image.name);

    // Disable post controls while posting
    this.postingDisabled = true;

    // Save name in cookie
    $.cookie("post_name", this.post.name);

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
      this.postingProgress = "Posted.";
      this.clearPost();

      // Activate posting cooldown
      this.postingCooldown = 5;
      let cooldownInterval = setInterval(() => {
        this.postingCooldown -= 1;

        if (this.postingCooldown <= 0) {
          clearInterval(cooldownInterval);

          if (this.submitOnCooldown) {
            this.submitOnCooldown = false;
            this.submitPost();
          }
        }
      }, 1000);
    });

    ajaxPost.always(() => {
      this.postingDisabled = false;

      setTimeout(() => {
        this.postingProgress = "";
      }, 2000);
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

  submitOnEnterKeypress(event) {
    if (event.keyCode == 13) {
      this.submitPost();
      return false;
    }

    return true;
  }

  get postButtonText() {
    if (this.postingCooldown > 0) {
      if (this.submitOnCooldown) {
        return `Auto (${this.postingCooldown})`;
      } else {
        return `${this.postingCooldown}`;
      }
    }

    return "Post";
  }
}
