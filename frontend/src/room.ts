import {autoinject} from "aurelia-framework";
import { HttpClient } from "aurelia-fetch-client";
import { Router } from "aurelia-router";

import { State } from "./state";
import fullscreenUtils from "./utils/fullscreen";

import io from "socket.io-client";
import * as $ from "jquery";

import "styles/room.less";

@autoinject
export class Room {
  private room: HTMLDivElement;
  private chatContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;

  private roomName: string;
  private contentUrl: string;
  private embeddedContent: string[];

  public showRoomControls: boolean;

  constructor(
    private router: Router,
    private state: State,
    private http: HttpClient,
  ) {
  }

  async activate(params: { roomName: string }) {
    this.roomName = params.roomName;
    this.state.roomName = this.roomName;

    console.log('ACT ROOM', this.roomName);

    let roomExists = await this.checkRoomExists();

    if (!roomExists) {
      this.router.navigateToRoute('claim', { roomName: this.roomName });
    }
  }

  bind() {
    /* We have to use this window.location.origin + "/namespace" workaround
       because of a bug in socket.io causing the port number to be omitted,
       that's apparently been there for ages and yet still hasn't been fixed
       in a release. Get your shit together, Socket.io people. */
    let socket = io(window.location.origin + "/room", { path: "/aria-ws", autoConnect: false });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
      console.log('JOINED');
    });

    socket.on("content", (content) => {
      console.log('CONTENT', content);
      this._setContent(content.url);
    });

    socket.connect();
  }

  attached() {
    let w = $(window);
    let chatContainer = $(this.chatContainer);
    let contentContainer = $(this.contentContainer);

    function resize() {
      let width = w.width();
      let height = w.height();

      if (height > width) {
        // Portrait mode
        contentContainer.css("left", "");
        contentContainer.css("bottom", chatContainer.height() + 4);
      } else {
        // Landscape mode
        contentContainer.css("bottom", "");
        contentContainer.css("left", chatContainer.width() + 2);
      }
    }

    resize();

    w.resize(() => {
      resize();
    });
  }

  _setContent(url) {
    this.contentUrl = url;
    this.embeddedContent = [url];
  }

  reloadContent() {
    // Store original content URL
    let contentUrl = this.contentUrl;

    // Set blank content URL to clear content
    this._setContent(null);

    /* The restoration needs to go in a 1 second timeout, because otherwise it
       doesn't work for some types of content. */
    setTimeout(() => {
      // Restore content URL to reload content
      this._setContent(contentUrl);
    }, 1);
  }

  toggleFullscreen() {
    if (!fullscreenUtils.isInFullscreen()) {
      fullscreenUtils.requestFullscreen(this.room);
    } else {
      fullscreenUtils.exitFullscreen();
    }
  }

  toggleRoomControls() {
    this.showRoomControls = !this.showRoomControls;
  }

  private checkRoomExists(): PromiseLike<boolean> {
    return this.http.fetch(`/api/r/${this.roomName}`, {
      method: "GET",
    }).then((response) => {
      if (!response.ok) {
        return false;
      }

      return true;
    });
  }
}