<script setup lang="ts">
import { onBeforeMount, onMounted, onUnmounted, provide, ref, toRefs } from "vue";
import router from "@/router";

import Chat from "./Chat.vue";
import ToastChat from "./ToastChat.vue";
import Player from "./Player.vue";
import RoomControls from "./RoomControls.vue";
import { LocalRoomSettingsService } from "@/services/localroomsettingsservice";
import { RoomAdminService } from "@/services/roomadminservice";
import { LocalRoomAuthService } from "@/services/localroomauthservice";

import type { Content, RoomInfo } from "@/models";
import { RoomService } from "@/services/room";
import { AriaWebSocket, AriaWsListener } from "@/services/websocket";

interface PlaybackState {
  time: number;
  rate: number;
  is_playing: boolean;
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

const ws_protocol = window.location.protocol === "https:" ? "wss" : "ws";

const ws_url = `${ws_protocol}://${window.location.host}/aria-ws`;
const ws = new AriaWebSocket(ws_url, name.value);

provide("room", roomInfo);
provide("auth", localRoomAuthService);
provide("settings", localRoomSettingsService);
provide("admin", roomAdminService);
provide("ws", ws);

const showRoomControls = ref(false);

const room = ref<HTMLDivElement | null>(null);
const toastChat = ref<typeof ToastChat | null>(null);
const player = ref<typeof Player | null>(null);

const chatTheme = ref<string>("dark");
const theaterMode = ref(false);

const content = ref<Content | null>(null);
let isMaster = false;
let isViewerPaused = false;
let serverPlaybackStateTimestamp = 0;
let serverPlaybackState: PlaybackState = {
  time: 0,
  rate: 1,
  is_playing: false,
};

let ws_listener: AriaWsListener | undefined;
onMounted(async () => {
  const isAuthorized = await roomAdminService.getLoginStatus();
  isMaster = isAuthorized;

  ws_listener = ws.create_listener();

  ws_listener.on("joined", () => {
    if (isMaster) {
      ws.send("set-master");
    }
  });

  ws_listener.on("content", async (_content: Content) => {
    await setContent(_content);
  });

  ws_listener.on("not-master", () => {
    isMaster = false;
  });

  ws_listener.on("playbackstate", async (ps: PlaybackState) => {
    serverPlaybackStateTimestamp = getTimestamp();
    ps.time += ws.latency * ps.rate;

    await setPlaybackState(ps);
  });

  ws.connect();
});

onBeforeMount(async () => {
  const roomExists = await roomService.exists();

  if (!roomExists) {
    router.push({ name: "claim", params: { room: name.value } });
  }
});

onUnmounted(() => {
  ws_listener?.dispose();
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
    is_playing: _player.getIsPlaying(),
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

  if (ps.is_playing) {
    const elapsedSinceTimestamp = ((getTimestamp() - serverPlaybackStateTimestamp) * ps.rate) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    if (ps.rate !== currentPlaybackState.rate) {
      _player.setRate(ps.rate);
    }

    const timeDiff = Math.abs(currentPlaybackState.time - newTime);
    if (timeDiff > 2) {
      console.log("Synchronizing to server time.", timeDiff);
      _player.setTime(newTime);
    }

    if (!currentPlaybackState.is_playing) {
      _player.setTime(newTime);
      _player.play();
    }
  } else if (!ps.is_playing && currentPlaybackState.is_playing) {
    _player.pause();
  }
};

const broadcastPlaybackState = async () => {
  if (!isMaster) return;

  const ps = (await getPlaybackState()) || serverPlaybackState;
  ps.time += ws.latency * ps.rate;

  ws.send("master-playbackstate", ps);
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
@use "@/styles/room.scss" as *;
</style>
