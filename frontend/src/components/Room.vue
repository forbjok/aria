<script setup lang="ts">
import { onBeforeMount, onMounted, provide, ref, toRefs } from "vue";
import router from "@/router";

import io, { Socket } from "socket.io-client";
import YouTubePlayer from "youtube-player";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import videojs from "video.js";
import $ from "jquery";

import Chat from "./Chat.vue";
import RoomControls from "./RoomControls.vue";
import { LocalRoomSettingsService } from "@/services/localroomsettingsservice";
import { RoomAdminService } from "@/services/roomadminservice";
import fullscreenUtils from "../utils/fullscreen";
import axios from "axios";
import { LocalRoomAuthService } from "@/services/localroomauthservice";

import "@/styles/room.scss";
import type { RoomInfo } from "@/models";

interface PlaybackState {
  time: number;
  rate: number;
  isPlaying: boolean;
}

interface PlaybackController {
  getPlaybackState(): Promise<PlaybackState>;
  setTime(time: number): void;
  setRate(rate: number): void;
  play(): void;
  pause(): void;
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
  onError: (message: string) => void;
}

interface Content {
  type: string;
  url: string;
  meta: {
    [key: string]: any;
  };
}

function getTimestamp(): number {
  return new Date().getTime();
}

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);

const roomInfo: RoomInfo = { name: name.value };
const localRoomAuthService = new LocalRoomAuthService(roomInfo);
const localRoomSettingsService = new LocalRoomSettingsService(roomInfo);
const roomAdminService = new RoomAdminService(roomInfo, localRoomAuthService);

provide("room", roomInfo);
provide("auth", localRoomAuthService);
provide("settings", localRoomSettingsService);
provide("admin", roomAdminService);

const showRoomControls = ref(false);
const sources = ref<Source[]>([]);

const room = ref<HTMLDivElement | null>(null);
const chatContainer = ref<HTMLDivElement | null>(null);
const contentContainer = ref<HTMLDivElement | null>(null);
const embeddedVideo = ref<HTMLMediaElement | null>(null);
const youtubePlayer = ref<HTMLDivElement | null>(null);
const googleDriveVideo = ref<HTMLMediaElement | null>(null);

let socket: Socket;
const content = ref<Content | null>(null);
let latency = 0;
let playbackController: PlaybackController | null;
let isMaster = false;
let isAutoUpdate = false;
let isViewerPaused = false;
let serverPlaybackStateTimestamp = 0;
let serverPlaybackState: PlaybackState = {
  time: 0,
  rate: 1,
  isPlaying: false,
};
let isYouTubePlayerLoaded = false;

onMounted(async () => {
  const isAuthorized = await roomAdminService.getLoginStatus();
  isMaster = isAuthorized;

  // We have to use this window.location.origin + "/namespace" workaround
  // because of a bug in socket.io causing the port number to be omitted,
  // that's apparently been there for ages and yet still hasn't been fixed
  // in a release. Get your shit together, Socket.io people.
  socket = io(window.location.origin + "/room", { path: "/aria-ws", autoConnect: false });

  socket.on("connect", () => {
    socket.emit("join", name.value);
  });

  socket.on("joined", () => {
    if (isMaster) {
      socket.emit("set-master");
    }
  });

  socket.on("content", (content: Content) => {
    setContent(content);
  });

  socket.on("not-master", () => {
    isMaster = false;
  });

  socket.on("playbackstate", (ps: PlaybackState) => {
    serverPlaybackStateTimestamp = getTimestamp();
    ps.time += latency * ps.rate;

    setPlaybackState(ps);
  });

  socket.on("pong", (ts: number) => {
    latency = (getTimestamp() - ts) / 2 / 1000;
  });

  setInterval(() => {
    socket.emit("ping", getTimestamp());
  }, 30000);

  socket.connect();

  const w = $(window);

  if (!chatContainer.value || !contentContainer.value) return;

  const chatContainer1 = $(chatContainer.value);
  const contentContainer1 = $(contentContainer.value);

  function resize() {
    const width = w.width() || 0;
    const height = w.height() || 0;

    if (height > width) {
      // Portrait mode
      contentContainer1.css("left", "");
      contentContainer1.css("bottom", (chatContainer1.height() || 0) + 4);
    } else {
      // Landscape mode
      contentContainer1.css("bottom", "");
      contentContainer1.css("left", (chatContainer1.width() || 0) + 2);
    }
  }

  resize();

  w.on("resize", () => {
    resize();
  });
});

onBeforeMount(async () => {
  const roomExists = await checkRoomExists();

  if (!roomExists) {
    router.push({ name: "claim", params: { room: name.value } });
  }
});

const setContent = async (_content: Content | null) => {
  content.value = _content;
  if (content.value == null) return;

  if (content.value.type === "youtube") {
    if (isYouTubePlayerLoaded) {
      // Reload page.
      // This is a workaround for the YouTube player breaking on use.
      // Ideally a better solution should be found.
      location.reload();
    }

    setTimeout(() => {
      const ytp = YouTubePlayer(youtubePlayer.value as HTMLElement, {
        videoId: content.value?.meta.id,
      });

      isYouTubePlayerLoaded = true;

      playbackController = {
        getPlaybackState: async (): Promise<PlaybackState> => {
          return {
            time: await ytp.getCurrentTime(),
            rate: await ytp.getPlaybackRate(),
            isPlaying: (await ytp.getPlayerState()) === PlayerStates.PLAYING,
          };
        },
        setTime: async (time) => {
          await ytp.seekTo(time, true);
        },
        setRate: async (rate) => {
          await ytp.setPlaybackRate(rate);
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
          onPlay();
        } else if (event.data === PlayerStates.PAUSED) {
          onPause();
        }
      });

      ytp.on("playbackRateChange", () => {
        onRateChange();
      });
    }, 100);
    return;
  }

  if (content.value.type === "google_drive") {
    setTimeout(() => {
      if (!content.value) {
        return;
      }

      const embeddedVideo = googleDriveVideo.value;

      const detail: UserscriptDetails = {
        content: {
          contentType: content.value.type,
          url: content.value.url,
          meta: content.value.meta,
        },
        onLoaded: (_sources) => {
          console.log("Google Drive Userscript successfully retrieved sources.", _sources);
          sources.value = _sources;

          setTimeout(() => {
            if (!embeddedVideo) {
              return;
            }

            videojs(embeddedVideo, { controls: true });
            embeddedVideo.load();

            playbackController = {
              getPlaybackState: async (): Promise<PlaybackState> => {
                return {
                  time: embeddedVideo.currentTime,
                  rate: embeddedVideo.playbackRate,
                  isPlaying: !embeddedVideo.paused,
                };
              },
              setTime: (time) => {
                embeddedVideo.currentTime = time;
              },
              setRate: async (rate) => {
                embeddedVideo.playbackRate = rate;
              },
              play: () => {
                embeddedVideo.play();
              },
              pause: () => {
                embeddedVideo.pause();
              },
            };

            setTimeout(() => {
              setPlaybackState(serverPlaybackState);
            }, 1);
          }, 100);
        },
        onError: (message) => {
          alert(`Google Drive Userscript failed: ${message}`);
        },
      };

      const contentLoadingEvent = new CustomEvent("contentLoading", { detail });

      document.dispatchEvent(contentLoadingEvent);
    }, 1);
    return;
  }

  setTimeout(() => {
    if (!content.value) {
      return;
    }

    sources.value = [
      {
        url: content.value.url,
        mediaType: "",
        description: "default",
      },
    ];

    const video = embeddedVideo.value;

    setTimeout(() => {
      if (!video) {
        return;
      }

      videojs(video, { controls: true });
      video.load();

      playbackController = {
        getPlaybackState: async (): Promise<PlaybackState> => {
          return {
            time: video.currentTime,
            rate: video.playbackRate,
            isPlaying: !video.paused,
          };
        },
        setTime: (time) => {
          video.currentTime = time;
        },
        setRate: async (rate) => {
          video.playbackRate = rate;
        },
        play: () => {
          video.play();
        },
        pause: () => {
          video.pause();
        },
      };
    }, 100);
  }, 1);
};

const reloadContent = async () => {
  // Store original content
  const original_content = content.value;
  const playbackState = (await playbackController?.getPlaybackState()) || serverPlaybackState;

  // Set blank content to unload content
  setContent(null);

  // The restoration needs to go in a 1 second timeout, because otherwise it
  // doesn't work for some types of content.
  setTimeout(() => {
    // Restore content to reload
    setContent(original_content);

    setTimeout(() => {
      setPlaybackState(playbackState);
    }, 1);
  }, 1);
};

const toggleFullscreen = () => {
  if (!fullscreenUtils.isInFullscreen()) {
    fullscreenUtils.requestFullscreen(room.value);
  } else {
    fullscreenUtils.exitFullscreen();
  }
};

const toggleRoomControls = () => {
  showRoomControls.value = !showRoomControls.value;
};

const onPlay = async () => {
  isViewerPaused = false;

  if (!isMaster) {
    await setPlaybackState(serverPlaybackState);
    return;
  }

  await broadcastPlaybackState();
};

const onPlaying = async () => {
  if (isMaster) return;
  await setPlaybackState(serverPlaybackState);
};

const onPause = async () => {
  if (isAutoUpdate && !isMaster) {
    return;
  }

  isViewerPaused = true;
  await broadcastPlaybackState();
};

const onSeek = async () => {
  await broadcastPlaybackState();
};

const onRateChange = async () => {
  await broadcastPlaybackState();
};

const checkRoomExists = async (): Promise<boolean> => {
  try {
    await axios.get(`/api/r/${name.value}`);
  } catch {
    // TODO: Verify if this works or if we need to check response
    return false;
  }

  return true;
};
const setPlaybackState = async (ps: PlaybackState) => {
  serverPlaybackState = ps;

  if (!playbackController) {
    return;
  }

  if (isViewerPaused) {
    return;
  }

  const currentPlaybackState = await playbackController.getPlaybackState();

  isAutoUpdate = true;

  if (ps.isPlaying) {
    const elapsedSinceTimestamp = ((getTimestamp() - serverPlaybackStateTimestamp) * ps.rate) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    if (ps.rate !== currentPlaybackState.rate) {
      playbackController.setRate(ps.rate);
    }

    const timeDiff = Math.abs(currentPlaybackState.time - newTime);
    if (timeDiff > 2) {
      console.log("Synchronizing to server time.");
      playbackController.setTime(newTime);
    }

    if (!currentPlaybackState.isPlaying) {
      playbackController.setTime(newTime);
      playbackController.play();
    }
  } else if (!ps.isPlaying && currentPlaybackState.isPlaying) {
    playbackController.pause();
  }

  setTimeout(() => (isAutoUpdate = false), 100);
};

const broadcastPlaybackState = async () => {
  if (!isMaster) return;
  if (isAutoUpdate) return;

  const ps = (await playbackController?.getPlaybackState()) || serverPlaybackState;
  ps.time += latency * ps.rate;

  socket.emit("master-playbackstate", ps);
};
</script>

<template>
  <div ref="room" class="room">
    <div ref="chatContainer" id="chatcontainer" class="chatcontainer">
      <Chat :room="name"></Chat>
    </div>
    <div ref="contentContainer" id="content-container" class="contentcontainer">
      <div v-if="!!content" class="video-container">
        <div v-if="content.type == 'unknown'" class="video-container">
          <video
            controls
            ref="embeddedVideo"
            class="video-container video-js"
            @play="onPlay()"
            @playing="onPlaying()"
            @pause="onPause()"
            @seeked="onSeek()"
            @ratechange="onRateChange()"
          >
            <source v-for="source of sources" :key="source.description" :src="source.url" :type="source.mediaType" />
          </video>
        </div>
        <div v-if="content.type == 'youtube'" class="video-container youtube-player">
          <div ref="youtubePlayer" class="video-container"></div>
        </div>
        <div v-if="content.type == 'google_drive'" class="video-container">
          <video
            controls
            ref="googleDriveVideo"
            class="video-container video-js"
            @play="onPlay()"
            @playing="onPlaying()"
            @pause="onPause()"
            @seeked="onSeek()"
            @ratechange="onRateChange()"
          >
            <source v-for="source of sources" :key="source.description" :src="source.url" :type="source.mediaType" />
          </video>
        </div>
        <div class="usercontrols-activationzone">
          <div class="usercontrols">
            <a href="#" class="usercontrol" title="Reload" @click="reloadContent()"
              ><span class="fa fa-refresh"></span
            ></a>
            <a href="#" class="usercontrol" title="Fullscreen" @click="toggleFullscreen()"
              ><span class="fa fa-television"></span
            ></a>
          </div>
        </div>
      </div>
      <div class="admincontrols">
        <button type="button" name="controlpanel" @click="toggleRoomControls()">
          <span class="fa fa-wrench"></span>
        </button>
      </div>
    </div>
    <div v-if="showRoomControls" class="roomcontrols-container">
      <div class="overlay" @click="toggleRoomControls()"></div>
      <RoomControls class="dialog"></RoomControls>
    </div>
  </div>
</template>

<style scoped></style>
