import {autoinject, bindable, computedFrom} from "aurelia-framework";

import io from "socket.io-client";
import * as $ from "jquery";
import "jq-ajax-progress";

import filesize from "filesize";

import {version} from "./version";
import {LocalRoomSettingsService} from "./services/localroomsettingsservice";

import "styles/chat.less";
import "styles/chat-dark.less";

let maxImageSize = 2097152;

@autoinject
export class ChatCustomElement {
  @bindable room: string;

  postContainer: HTMLDivElement;
  chatControls: HTMLDivElement;

  posts: any[]
  themes: Theme[]
  theme: string;
  posting: boolean;
  postingCooldown: number;
  post: any;
  postForm: HTMLFormElement;
  useCompactPostForm: boolean;
  postingProgress: string;
  submitOnCooldown: boolean;
  triggerPostLayout: boolean;

  public versionText: string = `v${version}`;

  constructor(
    private element: Element,
    private settings: LocalRoomSettingsService)
  {
    this.posts = [];
    this.themes = [
      { name: "dark", description: "Dark" },
      { name: "yotsubab", description: "Yotsuba B" }
    ];

    this.theme = this.settings.get("chat_theme", null) || "dark";
    this.posting = false;
    this.postingCooldown = 0;

    this.post = {};
    this.useCompactPostForm = false;
  }

  clearPost() {
    this.postForm.reset();
    this.post = {
      name: this.settings.get("chat_name", null) || "",
      comment: ""
    };
  }

  get postUrl() {
    return `/api/chat/${this.room}/post`;
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

  _activatePostingCooldown() {
    this.postingCooldown = 5;
    let cooldownInterval = setInterval(() => {
      this.postingCooldown -= 1;

      if (this.postingCooldown <= 0) {
        clearInterval(cooldownInterval);
        this.postingProgress = "";

        if (this.submitOnCooldown) {
          this.submitOnCooldown = false;
          this.submitPost(null);
        }
      }
    }, 1000);
  }

  submitPost(event: any) {
    event.preventDefault();

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
    this.settings.set("chat_name", this.post.name);

    console.log('AY');


    let ajaxPost = $.ajax(this.postUrl, {
      method: "POST",
      data: formData,
      contentType: false,
      processData: false,
    });

    console.log('BEE', ajaxPost);

    /* TODO: Check if this actually works */
    let ajaxPostAny: any = ajaxPost;
    ajaxPostAny.progress((e) => {
      if (e.lengthComputable) {
        let percentComplete = Math.round((e.loaded / e.total) * 100);
        this.postingProgress = `${percentComplete}%`;
      } else {
        this.postingProgress = "Posting...";
      }
    });

    ajaxPost.done(() => {
      this.postingProgress = "Posted.";
      this.clearPost();

      // Activate posting cooldown
      this._activatePostingCooldown();
    });

    ajaxPost.fail((jqXHR, textStatus, errorThrown) => {
      // Display the error response from the server
      this.postingProgress = jqXHR.responseText;

      // Activate posting cooldown
      this._activatePostingCooldown();
    });

    ajaxPost.always(() => {
      this.posting = false;
    });
  }

  bind() {
    const url = window.location.origin + "/chat";

    /* We have to use this window.location.origin + "/namespace" workaround
       because of a bug in socket.io causing the port number to be omitted,
       that's apparently been there for ages and yet still hasn't been fixed
       in a release. Get your shit together, Socket.io people. */
    let socket = io(url, { path: "/aria-ws", autoConnect: false });

    socket.on("connect", () => {
      this.posts = [];
      socket.emit("join", this.room);
    });

    socket.on("post", (post) => {
      this.posts.push(post);
    });

    socket.connect();
  }

  _resizeChatControls() {
    $(this.postContainer).css("bottom", $(this.chatControls).height() + 4);
    this._triggerPostLayout();
  }

  attached() {
    this._resizeChatControls();

    this.clearPost();
  }

  imageSelected(event) {
    this.post.image = event.target.files[0];

    if (this.post.image && this.post.image.size > maxImageSize) {
      alert(`The selected file is bigger than the maximum allowed size of ${filesize(maxImageSize)}`);
    }
  }

  themeSelected() {
    this.settings.set("chat_theme", this.theme);
  }

  toggleCompactPostForm() {
    this.useCompactPostForm = !this.useCompactPostForm;

    setInterval(() => {
      this._resizeChatControls();
    }, 1);
  }

  toggleImage(post) {
    post.showFullImage = !post.showFullImage;
  }

  submitOnEnterKeypress(event) {
    if (event.keyCode === 13 && !event.shiftKey) {
      this.submitPost(event);
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

  @computedFrom("postingCooldown", "submitOnCooldown")
  get postingCooldownText() {
    if (this.postingCooldown > 0) {
      if (this.submitOnCooldown) {
        return `Auto (${this.postingCooldown})`;
      }

      return `${this.postingCooldown}`;
    }
  }

  /* The purpose of this function is to work around a bug in Chrome that
     causes it to not recalculate the layout of posts when the posting
     form is resized. In order to force this, we set "triggerPostLayout"
     to true briefly before resetting it to false. Because it is bound to
     an empty div at the end of the post-container with if.bind, it will
     trigger a layout update. */
  _triggerPostLayout() {
    this.triggerPostLayout = true;

    setInterval(() => {
      this.triggerPostLayout = false;
    }, 100);
  }
}