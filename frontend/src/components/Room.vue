<script setup lang="ts">
import { defineAsyncComponent, inject, onMounted, onUnmounted, provide, reactive, ref, toRefs, watch } from "vue";
import router from "@/router";

import Chat from "@/components/chat/Chat.vue";
import ToastChat from "@/components/chat/ToastChat.vue";
import Player from "./Player.vue";
import Dialog from "@/components/common/Dialog.vue";
import LogIn from "@/components/admin/LogIn.vue";
import RoomControls from "./RoomControls.vue";

import { RoomAdminService } from "@/services/room-admin";
import { RoomAuthService } from "@/services/room-auth";

import type { Content, Emote } from "@/models";
import { RoomService } from "@/services/room";
import { AriaWebSocket, AriaWsListener } from "@/services/websocket";
import { UserService } from "@/services/user";
import type { LocalStorageService } from "@/services/localstorage";
import type { RoomSettings } from "@/settings";

const AdminPanel = defineAsyncComponent(() => import("@/components/admin/AdminPanel.vue"));

enum ContentKind {
  Video = "video",
  Other = "other",
}

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

const DEFAULT_SETTINGS: RoomSettings = {
  chatName: "",
  theme: "dark",
  isRightSideChat: false,

  postBadges: {
    room_admin: false,
  },
};

const storage = inject<LocalStorageService>("storage")!;

const isRoomLoaded = ref(false);

const roomService = new RoomService(name.value);
const auth = new RoomAuthService(roomService);
const settings = reactive<RoomSettings>({ ...DEFAULT_SETTINGS });
const admin = new RoomAdminService(roomService, auth);
const user = new UserService();

const ws_protocol = window.location.protocol === "https:" ? "wss" : "ws";

const ws_url = `${ws_protocol}://${window.location.host}/aria-ws`;
const ws = new AriaWebSocket(ws_url, roomService, user);

provide("room", roomService);
provide("auth", auth);
provide("settings", settings);
provide("admin", admin);
provide("user", user);
provide("ws", ws);

const logInDialog = ref<typeof Dialog>();
const roomControlsDialog = ref<typeof Dialog>();
const adminPanelDialog = ref<typeof Dialog>();

const room = ref<HTMLDivElement>();
const toastChat = ref<typeof ToastChat>();
const player = ref<typeof Player>();

const theaterMode = ref(false);

const content = ref<Content>();
const contentKind = ref<ContentKind>();
const isContentLoaded = ref(false);
const contentUrl = ref<string>();
const isMaster = ref(false);
const isDetached = ref(false);

const isPlayerInteractedWith = ref(false);
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
  await user.setup();
  await roomService.setup();

  if (!roomService.exists()) {
    router.push({ name: "claim", params: { room: name.value } });
    return;
  }

  const roomSettingsKeyName = `room_${name.value}`;

  // Load setings from local storage
  Object.assign(settings, storage.get(roomSettingsKeyName));

  // Automatically save settings when something changes
  watch(settings, () => {
    storage.set(roomSettingsKeyName, settings);
  });

  isRoomLoaded.value = true;

  await auth.setup();

  const authorizeWebsocket = async () => {
    ws.send("auth", await auth.getAccessToken());
  };

  ws_listener = ws.create_listener();

  ws_listener.on("joined", async () => {
    await authorizeWebsocket();
  });

  ws_listener.on("emotes", async (emotes: Emote[]) => {
    for (const e of emotes) {
      roomService.emotes.value[e.name] = e;
    }
  });

  ws_listener.on("emote", async (emote: Emote) => {
    roomService.emotes.value[emote.name] = emote;
  });

  ws_listener.on("delete-emote", async (name: string) => {
    delete roomService.emotes.value[name];
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

  if (!auth.isAuthorized.value) {
    const unwatch = watch(auth.isAuthorized, async () => {
      await authorizeWebsocket();
      unwatch();
    });
  }
});

onUnmounted(() => {
  ws_listener?.dispose();
});

const setContent = async (_content?: Content) => {
  isContentLoaded.value = false;

  content.value = _content;
  if (!content.value) return;

  if (content.value.type === "twitch") {
    contentKind.value = ContentKind.Other;
    contentUrl.value = `https://player.twitch.tv/?channel=${content.value.meta.channel}&parent=${window.location.hostname}`;
    return;
  }

  contentKind.value = ContentKind.Video;

  setTimeout(() => {
    player.value?.setContent(_content);
    isPlayerInteractedWith.value = false;
  }, 100);
};

const reloadContent = async () => {
  // Store original content
  const original_content = content.value;
  const playbackState = (await getPlaybackState()) || serverPlaybackState;

  // Set blank content to unload content
  setContent();

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

const showLogIn = () => {
  logInDialog.value?.show();
};

const showRoomControls = () => {
  roomControlsDialog.value?.show();
};

const showAdminPanel = () => {
  adminPanelDialog.value?.show();
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

  if (!isMaster.value || !isPlayerInteractedWith.value) {
    await setPlaybackState(serverPlaybackState);
  }

  isPlayerInteractedWith.value = true;

  if (isMaster.value) {
    isMasterInitiatedPlay = true;
  }
};

const onPlaying = async () => {
  if (isMaster.value) {
    if (isMasterInitiatedPlay) {
      await broadcastPlaybackState();
    }

    if (isPlayerInteractedWith.value) {
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

  if (isPlayerInteractedWith.value) {
    isViewerPaused = true;
  } else {
    isPlayerInteractedWith.value = true;
  }

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

  if (isViewerPaused || !isPlayerInteractedWith.value) {
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

    if (isMaster.value) {
      return;
    }

    _player.pause();
  }
};

const broadcastPlaybackState = async () => {
  if (isDetached.value || !isMaster.value || !isPlayerInteractedWith.value) return;

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
    ws.send("set-master");
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
  <div v-if="isRoomLoaded" ref="room" class="room" :class="{ 'right-side-chat': settings.isRightSideChat }">
    <div v-if="isPlayerInteractedWith || !isContentLoaded" class="usercontrols-activationzone">
      <div class="usercontrols">
        <button class="usercontrol" title="Reload" @click="reloadContent">
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>
        <div class="spacer"></div>
        <button
          class="usercontrol"
          :class="{ 'usercontrol-off': !theaterMode }"
          title="Theater mode"
          @click="toggleTheaterMode"
        >
          <i class="fa-solid fa-film"></i>
        </button>
        <button
          class="usercontrol"
          title="Switch chat side"
          @click="settings.isRightSideChat = !settings.isRightSideChat"
        >
          <i class="fa-solid fa-arrow-right-arrow-left"></i>
        </button>
        <button
          class="usercontrol"
          :class="{ 'usercontrol-off': isDetached }"
          :title="isDetached ? 'Attach' : 'Detach'"
          @click="toggleDetached"
        >
          <i class="fa-solid fa-plug"></i>
        </button>
        <div class="spacer"></div>
        <button v-if="!auth.isAuthorized.value" class="usercontrol" title="Log In" @click="showLogIn">
          <i class="fa-solid fa-right-to-bracket"></i>
        </button>
        <div v-if="auth.isAuthorized.value" class="admin-controls usercontrol-group">
          <button class="usercontrol" title="Admin Panel" @click="showAdminPanel">
            <i class="fa-solid fa-gear"></i>
          </button>
          <button class="usercontrol" title="Set Content" @click="showRoomControls">
            <i class="fa-solid fa-video"></i>
          </button>
          <button
            class="usercontrol"
            :class="{ 'usercontrol-off': !isMaster }"
            title="Toggle master"
            @click="toggleMaster"
          >
            <i class="fa-solid fa-star"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-show="!theaterMode" ref="chatContainer" class="chat-container">
      <Chat :class="{ 'right-side-chat': settings.isRightSideChat }" @post="toastChat?.post($event)" />
    </div>
    <div ref="contentArea" class="content-area" @keydown="onContentAreaKeydown($event)">
      <div v-show="theaterMode" class="toast-chat-container">
        <ToastChat ref="toastChat" />
      </div>
      <Player
        v-if="contentKind === ContentKind.Video"
        ref="player"
        class="video-container"
        @contentloaded="isContentLoaded = true"
        @contenterror="isContentLoaded = false"
        @play="onPlay"
        @playing="onPlaying"
        @pause="onPause"
        @seek="onSeek"
        @ratechange="onRateChange"
      />
      <iframe
        v-if="contentKind === ContentKind.Other"
        class="video-container"
        :src="contentUrl"
        frameborder="0"
        allowfullscreen="true"
        scrolling="no"
      ></iframe>
    </div>

    <!-- Dialogs -->
    <Dialog ref="logInDialog" :darken="true" title="Log In">
      <LogIn @logged-in="logInDialog?.close()" />
    </Dialog>
    <Dialog ref="roomControlsDialog" :darken="true" title="Room Controls">
      <RoomControls @set-content="roomControlsDialog?.close()" />
    </Dialog>
    <Dialog ref="adminPanelDialog" :darken="true" title="Admin Panel">
      <AdminPanel />
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/room.scss" as *;
</style>
