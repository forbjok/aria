import { autoinject } from "aurelia-framework";
import { HttpClient } from "aurelia-fetch-client";
import { Router } from "aurelia-router";

import { State } from "./state";
import fullscreenUtils from "./utils/fullscreen";

import io, { Socket } from "socket.io-client";
import * as $ from "jquery";

import "styles/room.scss";
import { RoomAdminService } from "services/roomadminservice";

interface PlaybackState {
  timestamp: number;
  time: number;
  isPlaying: boolean;
}

@autoinject
export class Room {
  public showRoomControls: boolean;

  private room: HTMLDivElement;
  private chatContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private embeddedVideo: HTMLMediaElement;

  private socket: Socket;
  private contentUrl: string;
  private latency = 0;
  private isMaster = false;
  private isMasterPaused = false;
  private isViewerPaused = false;
  private masterPlaybackState: PlaybackState = {
    timestamp: 0,
    time: 0,
    isPlaying: false,
  };

  constructor(
    private router: Router,
    private state: State,
    private http: HttpClient,
    private adminService: RoomAdminService
  ) {}

  async activate(params: { roomName: string }) {
    this.state.roomName = params.roomName;

    const roomExists = await this.checkRoomExists();

    if (!roomExists) {
      this.router.navigateToRoute("claim", { roomName: this.state.roomName });
    }
  }

  get roomName(): string | undefined {
    return this.state.roomName;
  }

  async bind() {
    const isAuthorized = await this.adminService.getLoginStatus();
    this.isMaster = isAuthorized;

    /* We have to use this window.location.origin + "/namespace" workaround
       because of a bug in socket.io causing the port number to be omitted,
       that's apparently been there for ages and yet still hasn't been fixed
       in a release. Get your shit together, Socket.io people. */
    const socket = io(window.location.origin + "/room", { path: "/aria-ws", autoConnect: false });

    socket.on("connect", () => {
      socket.emit("join", this.state.roomName);
    });

    socket.on("content", (content) => {
      this.setContent(content.url);
    });

    socket.on("time", (ps: PlaybackState) => {
      if (this.isMaster) return;

      ps.timestamp = getTimestamp();
      ps.time += this.latency;

      this.setPlaybackState(ps);
    });

    socket.on("pong", (ts: number) => {
      this.latency = (getTimestamp() - ts) / 1000;
      this.broadcastPlaybackState();
    });

    setInterval(() => {
      socket.emit("ping", getTimestamp());
    }, 30000);

    socket.connect();

    this.socket = socket;
  }

  attached() {
    const w = $(window);
    const chatContainer = $(this.chatContainer);
    const contentContainer = $(this.contentContainer);

    function resize() {
      const width = w.width();
      const height = w.height();

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

  setContent(url: string) {
    this.contentUrl = url;
  }

  reloadContent() {
    // Store original content URL
    const contentUrl = this.contentUrl;
    const playbackState = this.getPlaybackState();

    // Set blank content URL to clear content
    this.setContent("");

    // The restoration needs to go in a 1 second timeout, because otherwise it
    // doesn't work for some types of content.
    setTimeout(() => {
      // Restore content URL to reload content
      this.setContent(contentUrl);

      setTimeout(() => {
        this.setPlaybackState(playbackState);
      }, 1);
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

  onVideoReady() {
    this.setPlaybackState(this.masterPlaybackState);
  }

  onPlay() {
    this.isViewerPaused = false;

    if (!this.isMaster) {
      this.setPlaybackState(this.masterPlaybackState);
    }

    this.broadcastPlaybackState();
  }

  onPause() {
    if (this.isMasterPaused && !this.isMaster) {
      return;
    }

    this.isViewerPaused = true;
    this.broadcastPlaybackState();
  }

  onSeek() {
    this.broadcastPlaybackState();
  }

  private async checkRoomExists(): Promise<boolean> {
    const response = await this.http.fetch(`/api/r/${this.state.roomName}`, {
      method: "GET",
    });

    if (!response.ok) {
      return false;
    }

    return true;
  }

  private getPlaybackState(): PlaybackState {
    return {
      timestamp: getTimestamp(),
      time: this.embeddedVideo.currentTime,
      isPlaying: !this.embeddedVideo.paused,
    };
  }

  private setPlaybackState(ps: PlaybackState) {
    this.masterPlaybackState = ps;

    if (this.isViewerPaused) {
      return;
    }

    const elapsedSinceTimestamp = (getTimestamp() - ps.timestamp) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    const timeDiff = Math.abs(this.embeddedVideo.currentTime - newTime);
    if (timeDiff > 2 || this.embeddedVideo.paused) {
      this.embeddedVideo.currentTime = newTime;
    }

    if (ps.isPlaying && this.embeddedVideo.paused) {
      this.isMasterPaused = false;
      this.embeddedVideo.currentTime = newTime;
      this.embeddedVideo.play();
    } else if (!ps.isPlaying && !this.embeddedVideo.paused) {
      this.isMasterPaused = true;
      this.embeddedVideo.pause();
    }
  }

  private broadcastPlaybackState() {
    if (!this.isMaster) return;

    const ps = this.getPlaybackState();
    ps.time += this.latency;

    this.socket.emit("master-time", this.state.roomName, ps);
  }
}

function getTimestamp(): number {
  return new Date().getTime();
}
