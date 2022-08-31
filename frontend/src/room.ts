import { autoinject } from "aurelia-framework";
import { HttpClient } from "aurelia-fetch-client";
import { Router } from "aurelia-router";
import YouTubePlayer from "youtube-player";

import { State } from "./state";
import fullscreenUtils from "./utils/fullscreen";

import io, { Socket } from "socket.io-client";
import * as $ from "jquery";

import "styles/room.scss";
import { RoomAdminService } from "services/roomadminservice";
import { Content } from "models/content";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import videojs from "video.js";
import "!style-loader!css-loader!video.js/dist/video-js.css";

interface PlaybackState {
  time: number;
  isPlaying: boolean;
}

interface PlaybackController {
  getPlaybackState(): Promise<PlaybackState>;
  setTime(time: number);
  play();
  pause();
}

interface Source {
  mediaType: string;
  url: string;
  description: string;
}

interface UserscriptDetails {
  content: {
    contentType: string;
    url: string;
    meta: {
      [key: string]: any;
    };
  };
  onLoaded: (sources: Source[]) => void;
}

@autoinject
export class Room {
  public showRoomControls: boolean;
  public sources: Source[];

  private room: HTMLDivElement;
  private chatContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private embeddedVideo: HTMLMediaElement;
  private youtubePlayer: HTMLDivElement;
  private googleDriveVideo: HTMLMediaElement;

  private socket: Socket;
  private content: Content | null;
  private latency = 0;
  private playbackController: PlaybackController | null;
  private isMaster = false;
  private isAutoUpdate = false;
  private isViewerPaused = false;
  private serverPlaybackStateTimestamp = 0;
  private serverPlaybackState: PlaybackState = {
    time: 0,
    isPlaying: false,
  };
  private isYouTubePlayerLoaded = false;

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

    socket.on("content", (content: Content) => {
      this.setContent(content);
    });

    socket.on("playbackstate", (ps: PlaybackState) => {
      this.serverPlaybackStateTimestamp = getTimestamp();
      ps.time += this.latency;

      this.setPlaybackState(ps);
    });

    socket.on("pong", (ts: number) => {
      this.latency = (getTimestamp() - ts) / 2 / 1000;
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

  async setContent(content: Content | null) {
    this.content = content;
    if (content == null) return;

    if (content.type === "youtube") {
      if (this.isYouTubePlayerLoaded) {
        // Reload page.
        // This is a workaround for the YouTube player breaking on use.
        // Ideally a better solution should be found.
        location.reload();
      }

      setTimeout(() => {
        const ytp = YouTubePlayer(this.youtubePlayer, {
          videoId: this.content?.meta.id,
        });

        this.isYouTubePlayerLoaded = true;

        this.playbackController = {
          getPlaybackState: async (): Promise<PlaybackState> => {
            return {
              time: await ytp.getCurrentTime(),
              isPlaying: (await ytp.getPlayerState()) === PlayerStates.PLAYING,
            };
          },
          setTime: async (time) => {
            await ytp.seekTo(time, true);
          },
          play: async () => {
            await ytp.playVideo();
          },
          pause: async () => {
            await ytp.pauseVideo();
          },
        };

        ytp.on("stateChange", (event) => {
          if (event.data === PlayerStates.PLAYING) {
            this.onPlay();
          } else if (event.data === PlayerStates.PAUSED) {
            this.onPause();
          }
        });
      }, 100);
      return;
    }

    if (content.type === "google_drive") {
      setTimeout(() => {
        const embeddedVideo = this.googleDriveVideo;

        const detail: UserscriptDetails = {
          content: {
            contentType: content.type,
            url: content.url,
            meta: content.meta,
          },
          onLoaded: (sources) => {
            this.sources = sources;

            setTimeout(() => {
              const player = videojs(embeddedVideo, { controls: true });
              embeddedVideo.load();

              this.playbackController = {
                getPlaybackState: async (): Promise<PlaybackState> => {
                  return {
                    time: embeddedVideo.currentTime,
                    isPlaying: !embeddedVideo.paused,
                  };
                },
                setTime: (time) => {
                  embeddedVideo.currentTime = time;
                },
                play: () => {
                  embeddedVideo.play();
                },
                pause: () => {
                  embeddedVideo.pause();
                },
              };
            }, 100);
          },
        };

        const contentLoadingEvent = new CustomEvent("contentLoading", { detail });

        document.dispatchEvent(contentLoadingEvent);
      }, 1);
      return;
    }

    setTimeout(() => {
      const embeddedVideo = this.embeddedVideo;

      this.sources = [
        {
          url: content.url,
          mediaType: "",
          description: "default",
        },
      ];

      setTimeout(() => {
        const player = videojs(embeddedVideo, { controls: true });
        embeddedVideo.load();

        this.playbackController = {
          getPlaybackState: async (): Promise<PlaybackState> => {
            return {
              time: embeddedVideo.currentTime,
              isPlaying: !embeddedVideo.paused,
            };
          },
          setTime: (time) => {
            embeddedVideo.currentTime = time;
          },
          play: () => {
            embeddedVideo.play();
          },
          pause: () => {
            embeddedVideo.pause();
          },
        };
      }, 100);
    }, 1);
  }

  async reloadContent() {
    // Store original content
    const content = this.content;
    const playbackState = (await this.playbackController?.getPlaybackState()) || this.serverPlaybackState;

    // Set blank content to unload content
    this.setContent(null);

    // The restoration needs to go in a 1 second timeout, because otherwise it
    // doesn't work for some types of content.
    setTimeout(() => {
      // Restore content to reload
      this.setContent(content);

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
    this.setPlaybackState(this.serverPlaybackState);
  }

  async onPlay() {
    this.isViewerPaused = false;

    if (!this.isMaster) {
      this.setPlaybackState(this.serverPlaybackState);
      return;
    }

    this.broadcastPlaybackState();
  }

  onPlaying() {
    if (this.isMaster) return;
    this.setPlaybackState(this.serverPlaybackState);
  }

  onPause() {
    if (this.isAutoUpdate && !this.isMaster) {
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
  private async setPlaybackState(ps: PlaybackState) {
    this.serverPlaybackState = ps;

    if (!this.playbackController) {
      return;
    }

    if (this.isViewerPaused) {
      return;
    }

    const currentPlaybackState = await this.playbackController.getPlaybackState();

    const elapsedSinceTimestamp = (getTimestamp() - this.serverPlaybackStateTimestamp) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    this.isAutoUpdate = true;

    if (ps.isPlaying) {
      const timeDiff = Math.abs(currentPlaybackState.time - newTime);
      if (timeDiff > 2) {
        this.playbackController.setTime(newTime);
      }

      if (!currentPlaybackState.isPlaying) {
        this.playbackController.setTime(newTime);
        this.playbackController.play();
      }
    } else if (!ps.isPlaying && currentPlaybackState.isPlaying) {
      this.playbackController.pause();
    }

    setTimeout(() => (this.isAutoUpdate = false), 100);
  }

  private async broadcastPlaybackState() {
    if (!this.isMaster) return;
    if (this.isAutoUpdate) return;

    const ps = (await this.playbackController?.getPlaybackState()) || this.serverPlaybackState;
    ps.time += this.latency;

    this.socket.emit("master-playbackstate", this.state.roomName, ps);
  }
}

function getTimestamp(): number {
  return new Date().getTime();
}
