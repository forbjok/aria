<script setup lang="ts">
import { onBeforeMount, onMounted, onUnmounted, provide, ref, toRefs } from "vue";
import router from "@/router";

import Chat from "./Chat.vue";
import ToastChat from "./ToastChat.vue";
import Player from "./Player.vue";
import RoomControls from "./RoomControls.vue";

import { RoomSettingsService } from "@/services/room-settings";
import { RoomAdminService } from "@/services/room-admin";
import { RoomAuthService } from "@/services/room-auth";

import type { Content, Emote, RoomInfo } from "@/models";
import { RoomService } from "@/services/room";
import { AriaWebSocket, AriaWsListener } from "@/services/websocket";
import { CommentParser } from "@/services/comment";

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

const roomInfo: RoomInfo = { name: name.value, emotes: {} };
const roomService = new RoomService(roomInfo);
const auth = new RoomAuthService(roomInfo);
const settings = new RoomSettingsService(roomInfo);
const admin = new RoomAdminService(roomInfo, auth);
const commentParser = new CommentParser(roomInfo);

const ws_protocol = window.location.protocol === "https:" ? "wss" : "ws";

const ws_url = `${ws_protocol}://${window.location.host}/aria-ws`;
const ws = new AriaWebSocket(ws_url, name.value);

provide("room", roomInfo);
provide("auth", auth);
provide("settings", settings);
provide("admin", admin);
provide("commentparser", commentParser);
provide("ws", ws);

const showRoomControls = ref(false);

const room = ref<HTMLDivElement | null>(null);
const toastChat = ref<typeof ToastChat | null>(null);
const player = ref<typeof Player | null>(null);

const chatTheme = ref<string>("dark");
const theaterMode = ref(false);

const content = ref<Content | null>(null);
const isMaster = ref(false);
const isDetached = ref(false);

let isPlayerInteractedWith = false;
let isMasterInitiatedPlay = false;
let isViewerPaused = false;
let serverPlaybackStateTimestamp = 0;
let serverPlaybackState: PlaybackState = {
  time: 0,
  rate: 1,
  is_playing: false,
};

let ws_listener: AriaWsListener | undefined;
onMounted(async () => {
  await auth.setup();

  ws_listener = ws.create_listener();

  ws_listener.on("emotes", async (emotes: Emote[]) => {
    for (const e of emotes) {
      roomInfo.emotes[e.name] = e;
    }
  });

  ws_listener.on("emote", async (emote: Emote) => {
    roomInfo.emotes[emote.name] = emote;
  });

  ws_listener.on("content", async (_content: Content) => {
    await setContent(_content);
  });

  ws_listener.on("not-master", () => {
    isMaster.value = false;
  });

  ws_listener.on("playbackstate", async (ps: PlaybackState) => {
    serverPlaybackStateTimestamp = getTimestamp();
    serverPlaybackState = ps;
    serverPlaybackState.time += ws.latency * ps.rate;

    if (isMaster.value && isPlayerInteractedWith) {
      return;
    }

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
  isPlayerInteractedWith = false;
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

let isPlayerStateCooldown = false;
const activatePlayerStateCooldown = () => {
  isPlayerStateCooldown = true;
  setTimeout(() => {
    isPlayerStateCooldown = false;
  }, 100);
};

const onPlay = async (auto: boolean) => {
  if (auto) {
    return;
  }

  isViewerPaused = false;

  if (!isMaster.value || !isPlayerInteractedWith) {
    await setPlaybackState(serverPlaybackState);
  }

  isPlayerInteractedWith = true;

  if (isMaster.value) {
    isMasterInitiatedPlay = true;
  }
};

const onPlaying = async () => {
  if (isMaster.value) {
    if (isMasterInitiatedPlay) {
      await broadcastPlaybackState();
    }

    if (isPlayerInteractedWith) {
      return;
    }
  }

  setTimeout(() => {
    setPlaybackState(serverPlaybackState);
  }, 1);
};

const onPause = async (auto: boolean) => {
  if (auto) {
    return;
  }

  isPlayerInteractedWith = true;
  isViewerPaused = true;
  await broadcastPlaybackState();
};

const onSeek = async (auto: boolean) => {
  if (auto) {
    return;
  }

  await broadcastPlaybackState();
};

const onRateChange = async (auto: boolean) => {
  if (auto) {
    return;
  }

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
  if (isDetached.value) {
    return;
  }

  const _player = player.value;
  if (!_player || !_player.getIsContentLoaded()) {
    setTimeout(() => {
      setPlaybackState(ps);
    }, 1000);
    return;
  }

  if (isViewerPaused) {
    return;
  }

  const currentPlaybackState = await getPlaybackState();

  if (ps.is_playing || !isPlayerInteractedWith) {
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

    if (ps.is_playing && !currentPlaybackState.is_playing) {
      _player.setTime(newTime);

      if (isPlayerStateCooldown) {
        return;
      }

      _player.play();
      activatePlayerStateCooldown();
    }
  } else if (!ps.is_playing && currentPlaybackState.is_playing) {
    if (isPlayerStateCooldown) {
      return;
    }

    if (isMaster.value && !isPlayerInteractedWith) {
      return;
    }

    _player.pause();
  }
};

const broadcastPlaybackState = async () => {
  if (isDetached.value || !isMaster.value || !isPlayerInteractedWith) return;

  const ps = (await getPlaybackState()) || serverPlaybackState;
  ps.time += ws.latency * ps.rate;

  ws.send("master-playbackstate", ps);
};

const onContentAreaKeydown = (event: KeyboardEvent) => {
  if (event.key === "Tab" && !event.shiftKey) {
    toggleTheaterMode();
    event.preventDefault();
    return;
  }
};

const setMaster = (v: boolean) => {
  if (isMaster.value === v) {
    return;
  }

  isMaster.value = v;

  if (isMaster.value) {
    isDetached.value = false;
  }

  if (isMaster.value) {
    ws.send("set-master", auth.getToken());
  } else {
    ws.send("not-master");
  }
};

const toggleMaster = () => {
  setMaster(!isMaster.value);
};

const toggleDetached = () => {
  isDetached.value = !isDetached.value;

  if (isDetached.value) {
    setMaster(false);
  }

  if (!isDetached.value) {
    setPlaybackState(serverPlaybackState);
  }
};
</script>

<template>
  <div ref="room" class="room">
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
        <a
          v-if="auth.isAuthorized"
          href="#"
          class="usercontrol"
          :class="isMaster ? '' : 'usercontrol-off'"
          title="Toggle master"
          @click="toggleMaster"
        >
          <span class="fa fa-star"></span>
        </a>
        <a
          href="#"
          class="usercontrol"
          :class="isDetached ? 'usercontrol-off' : ''"
          :title="isDetached ? 'Attach' : 'Detach'"
          @click="toggleDetached"
        >
          <span class="fa fa-plug"></span>
        </a>
      </div>
    </div>
    <div v-show="!theaterMode" ref="chatContainer" class="chat-container">
      <Chat @post="toastChat?.post($event)" @themechange="chatTheme = $event"></Chat>
    </div>
    <div ref="contentArea" class="content-area" @keydown="onContentAreaKeydown($event)">
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
