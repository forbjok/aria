import {bindable, inject} from "aurelia-framework";

import $ from "jquery";
import Cookies from "js-cookie";
import "jq-ajax-progress";

import {SocketService} from "services/socketservice";

import filesize from "filesize";

let maxImageSize = 2097152;

@inject(Element, SocketService)
export class ChatCustomElement {
  @bindable room;

  constructor(element, socketService) {
    this.element = element;
    this.socketService = socketService;

    this.posts = [];
    this.themes = [
      { name: "dark", description: "Dark" },
      { name: "yotsubab", description: "Yotsuba B" }
    ];
    this.theme = Cookies.get("theme") || "dark";
    this.posting = false;
    this.postingCooldown = 0;
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: Cookies.get("post_name"),
      comment: ""
    };
  }

  get postUrl() {
    return `/chat/${this.room}/post`;
  }

  get canSubmitPost() {
    // Prevent duplicate submits
    if (this.posting) {
      return false;
    }

    let post = this.post;
    let image = post.image;

    // Disallow posts with neither comment nor image
    if (!post.comment && !image) {
      return false;
    }

    // Disallow posting images bigger than the max image size
    if (image && image.size > maxImageSize) {
      return false;
    }

    return true;
  }

  submitPost() {
    if (!this.canSubmitPost) {
      return;
    }

    if (this.postingCooldown > 0) {
      this.submitOnCooldown = !this.submitOnCooldown;
      return;
    }

    let post = this.post;
    let image = post.image;

    let formData = new FormData();
    formData.append("name", post.name);
    formData.append("comment", post.comment);

    if (image) {
      formData.append("image", image, image.name);
    }

    // Disable post controls while posting
    this.posting = true;

    // Save name in cookie
    Cookies.set("post_name", this.post.name, { path: window.location.pathname });

    let ajaxPost = $.ajax(this.postUrl, {
      method: "POST",
      data: formData,
      contentType: false,
      processData: false
    });

    ajaxPost.uploadProgress((e) => {
      if (e.lengthComputable) {
        let percentComplete = parseInt((e.loaded / e.total) * 100, 10);
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

  bind() {
    let socket = this.socketService.getSocket();
    this.socket = socket;

    socket.on("connect", () => {
      this.posts = [];
      socket.emit("chat:join", this.room);
    });

    socket.on("chat:" + this.room + ":post", (post) => {
      this.posts.push(post);
    });
  }

  attached() {
    let resizeChatControls = () => {
      $(this.postContainer).css("bottom", $(this.chatControls).height() + 4);
    }

    resizeChatControls();

    $(this.chatControls).resize(() => {
      resizeChatControls();
    });

    this.clearPost();

    // Connect websocket
    this.socket.connect();
  }

  imageSelected(event) {
    this.post.image = event.target.files[0];

    if (this.post.image && this.post.image.size > maxImageSize) {
      alert(`The selected file is bigger than the maximum allowed size of ${filesize(maxImageSize)}`);
    }
  }

  themeSelected() {
    Cookies.set("theme", this.theme, { path: "/" });
  }

  toggleImage(post) {
    post.showFullImage = !post.showFullImage;
  }

  submitOnEnterKeypress(event) {
    if (event.keyCode === 13) {
      this.submitPost();
      return false;
    }

    return true;
  }

  clearFileOnShiftClick(event) {
    if (event.shiftKey) {
      $(event.target).val("");
      delete this.post.image;
      return false;
    }

    return true;
  }

  get postButtonText() {
    if (this.postingCooldown > 0) {
      if (this.submitOnCooldown) {
        return `Auto (${this.postingCooldown})`;
      }

      return `${this.postingCooldown}`;
    }

    return "Post";
  }
}
