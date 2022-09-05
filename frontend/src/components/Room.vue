<script setup lang="ts">
import { onBeforeMount, onMounted, provide, ref, toRefs } from "vue";
import router from "@/router";

import io, { Socket } from "socket.io-client";

import Chat from "./Chat.vue";
import ToastChat from "./ToastChat.vue";
import Player from "./Player.vue";
import RoomControls from "./RoomControls.vue";
import { LocalRoomSettingsService } from "@/services/localroomsettingsservice";
import { RoomAdminService } from "@/services/roomadminservice";
import { LocalRoomAuthService } from "@/services/localroomauthservice";

import type { Content, RoomInfo } from "@/models";
import { RoomService } from "@/services/room";

interface PlaybackState {
  time: number;
  rate: number;
  isPlaying: boolean;
}

function getTimestamp(): number {
  return new Date().getTime();
}

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);

const roomInfo: RoomInfo = { name: name.value };
const roomService = new RoomService(roomInfo);
const localRoomAuthService = new LocalRoomAuthService(roomInfo);
const localRoomSettingsService = new LocalRoomSettingsService(roomInfo);
const roomAdminService = new RoomAdminService(roomInfo, localRoomAuthService);

provide("room", roomInfo);
provide("auth", localRoomAuthService);
provide("settings", localRoomSettingsService);
provide("admin", roomAdminService);

const showRoomControls = ref(false);

const room = ref<HTMLDivElement | null>(null);
const toastChat = ref<typeof ToastChat | null>(null);
const player = ref<typeof Player | null>(null);

const chatTheme = ref<string>("dark");
const theaterMode = ref(false);

let socket: Socket;
const content = ref<Content | null>(null);
let latency = 0;
let isMaster = false;
let isViewerPaused = false;
let serverPlaybackStateTimestamp = 0;
let serverPlaybackState: PlaybackState = {
  time: 0,
  rate: 1,
  isPlaying: false,
};

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
});

onBeforeMount(async () => {
  const roomExists = await roomService.exists();

  if (!roomExists) {
    router.push({ name: "claim", params: { room: name.value } });
  }
});

const setContent = async (_content: Content | null) => {
  content.value = _content;
  if (!content.value) return;
  if (!player.value) return;

  player.value.setContent(_content);
};

const reloadContent = async () => {
  // Store original content
  const original_content = content.value;
  const playbackState = (await getPlaybackState()) || serverPlaybackState;

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

const toggleTheaterMode = () => {
  theaterMode.value = !theaterMode.value;
};

const toggleRoomControls = () => {
  showRoomControls.value = !showRoomControls.value;
};

const onPlay = async (auto: boolean) => {
  if (!auto) {
    isViewerPaused = false;
  }

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

const onPause = async (auto: boolean) => {
  if (!auto) {
    isViewerPaused = true;
  }

  await broadcastPlaybackState();
};

const onSeek = async () => {
  await broadcastPlaybackState();
};

const onRateChange = async () => {
  await broadcastPlaybackState();
};

const getPlaybackState = async (): Promise<PlaybackState> => {
  const _player = player.value;

  if (!_player || !_player.getIsContentLoaded()) {
    return serverPlaybackState;
  }

  return {
    time: await _player.getTime(),
    rate: await _player.getRate(),
    isPlaying: _player.getIsPlaying(),
  };
};

const setPlaybackState = async (ps: PlaybackState) => {
  serverPlaybackState = ps;

  const _player = player.value;
  if (!_player || !_player.getIsContentLoaded()) {
    return;
  }

  if (isViewerPaused) {
    return;
  }

  const currentPlaybackState = await getPlaybackState();

  if (ps.isPlaying) {
    const elapsedSinceTimestamp = ((getTimestamp() - serverPlaybackStateTimestamp) * ps.rate) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    if (ps.rate !== currentPlaybackState.rate) {
      _player.setRate(ps.rate);
    }

    const timeDiff = Math.abs(currentPlaybackState.time - newTime);
    if (timeDiff > 2) {
      console.log("Synchronizing to server time.");
      _player.setTime(newTime);
    }

    if (!currentPlaybackState.isPlaying) {
      _player.setTime(newTime);
      _player.play();
    }
  } else if (!ps.isPlaying && currentPlaybackState.isPlaying) {
    _player.pause();
  }
};

const broadcastPlaybackState = async () => {
  if (!isMaster) return;

  const ps = (await getPlaybackState()) || serverPlaybackState;
  ps.time += latency * ps.rate;

  socket.emit("master-playbackstate", ps);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Tab" && !event.shiftKey) {
    toggleTheaterMode();
    event.preventDefault();
    return;
  }
};
</script>

<template>
  <div ref="room" class="room" @keydown="onKeydown($event)">
    <div class="usercontrols-activationzone">
      <div class="usercontrols">
        <a href="#" class="usercontrol" title="Reload" @click="reloadContent()"><span class="fa fa-refresh"></span></a>
        <a href="#" class="usercontrol" title="Theater mode" @click="toggleTheaterMode()"
          ><span class="fa fa-television"></span
        ></a>
        <div class="spacer"></div>
        <a href="#" class="usercontrol" title="Room Admin" @click="toggleRoomControls()"
          ><span class="fa fa-wrench"></span
        ></a>
      </div>
    </div>
    <div v-show="!theaterMode" ref="chatContainer" class="chat-container">
      <Chat :room="name" @post="toastChat?.post($event)" @themechange="chatTheme = $event"></Chat>
    </div>
    <div ref="contentArea" class="content-area">
      <div v-show="theaterMode" class="toast-chat-container">
        <ToastChat ref="toastChat" :theme="chatTheme"> </ToastChat>
      </div>
      <Player
        ref="player"
        class="video-container"
        @play="onPlay"
        @playing="onPlaying"
        @pause="onPause"
        @seek="onSeek"
        @ratechange="onRateChange"
      ></Player>
    </div>
    <div v-if="showRoomControls" class="roomcontrols-container">
      <div class="overlay" @click="toggleRoomControls()"></div>
      <RoomControls class="dialog"></RoomControls>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import "@/styles/room.scss";
</style>