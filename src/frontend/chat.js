import {inject} from "aurelia-framework";

import io from "socket.io-client";
import $ from "jquery";
import "jquery-cookie";
import "jq-ajax-progress";

import filesize from "filesize";

var maxImageSize = 2097152;

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
    this.posting = false;
    this.postingCooldown = 0;
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: $.cookie("post_name"),
      comment: ""
    };
  }

  get canSubmitPost() {
    // Prevent duplicate submits
    if (this.uploading)
      return false;

    var post = this.post;
    var image = post.image;

    // Disallow posts with neither comment nor image
    if (!post.comment && !image)
      return false;

    // Disallow posting images bigger than the max image size
    if (image && image.size > maxImageSize)
      return false;

    return true;
  }

  submitPost() {
    if (!this.canSubmitPost)
      return;

    if (this.postingCooldown > 0) {
      this.submitOnCooldown = !this.submitOnCooldown;
      return;
    }

    var post = this.post;
    var image = post.image;

    var formData = new FormData();
    formData.append("name", post.name);
    formData.append("comment", post.comment);

    if (image)
      formData.append("image", image, image.name);

    // Disable post controls while posting
    this.posting = true;

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
      this.posting = false;

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

    if(this.post.image && this.post.image.size > maxImageSize) {
      alert(`The selected file is bigger than the maximum allowed size of ${filesize(maxImageSize)}`);
    }
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
