<script setup lang="ts">
import { storeToRefs } from "pinia";
import { defineAsyncComponent, ref, watch } from "vue";

import LogIn from "@/components/admin/LogIn.vue";
import Chat from "@/components/chat/Chat.vue";
import ToastChat from "@/components/chat/ToastChat.vue";
import Dialog from "@/components/common/Dialog.vue";
import Player from "./Player.vue";
import RoomControls from "./RoomControls.vue";

import { useMainStore } from "@/stores/main";
import { type PlaybackState, useRoomStore } from "@/stores/room";

import type { Content } from "@/models";
import { type ContentInfo, ContentKind, getContentInfo } from "@/utils/content";
import { delay } from "@/utils/delay";
import { getTimestamp } from "@/utils/timestamp";

const AdminPanel = defineAsyncComponent(() => import("@/components/admin/AdminPanel.vue"));

const MAX_DIVERGENCE = 4;

const mainStore = useMainStore();
const roomStore = useRoomStore();

const isContentLoaded = ref(false);
const isDetached = ref(false);

const logInDialog = ref<typeof Dialog>();
const roomControlsDialog = ref<typeof Dialog>();
const adminPanelDialog = ref<typeof Dialog>();

const room = ref<HTMLDivElement>();
const toastChat = ref<typeof ToastChat>();
const player = ref<typeof Player>();

const theaterMode = ref(false);

const isPlayerInteractedWith = ref(false);
const isMasterPaused = ref(false);
const isViewerPaused = ref(false);

let contentInfo: ContentInfo | undefined;
let isMasterInitiatedPlay = false;
let lastBufferDuration = 0;
let bufferStartedAt: number | undefined;

const { content, serverPlaybackState } = storeToRefs(roomStore);
watch(content, (value) => {
  setContent(value);
});

watch(serverPlaybackState, async (value) => {
  if (roomStore.isMaster && isPlayerInteractedWith.value) {
    return;
  }

  await setPlaybackState(value);
});

const setContent = async (_content?: Content) => {
  if (isContentLoaded.value && _content?.url === contentInfo?.url) return;

  contentInfo = undefined;
  isContentLoaded.value = false;

  if (!_content || !_content.url) return;

  contentInfo = getContentInfo(_content.url);
  if (!contentInfo) return;

  if (_content?.is_livestream) {
    contentInfo.kind = ContentKind.Livestream;
  }

  await delay(100);

  player.value?.setContent(contentInfo);
  isPlayerInteractedWith.value = false;
};

const reloadContent = async () => {
  // Store original content
  const original_content = content.value;
  const playbackState = (await getPlaybackState()) || roomStore.serverPlaybackState;

  // Set blank content to unload content
  setContent();

  // The restoration needs to go in a 1 second timeout, because otherwise it
  // doesn't work for some types of content.
  await delay(1);

  // Restore content to reload
  setContent(original_content);

  await delay(1);

  setPlaybackState(playbackState);
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
const activatePlayerStateCooldown = async () => {
  isPlayerStateCooldown = true;

  await delay(100);

  isPlayerStateCooldown = false;
};

const onPlay = async (auto: boolean) => {
  if (!isPlayerInteractedWith.value) {
    isPlayerInteractedWith.value = true;
    await setPlaybackState(roomStore.serverPlaybackState);
  }

  if (auto) {
    return;
  }

  if (roomStore.isMaster) {
    isMasterInitiatedPlay = true;
  }
};

const onPlaying = async () => {
  if (bufferStartedAt) {
    lastBufferDuration = ((getTimestamp() - bufferStartedAt) / 1000 + lastBufferDuration) / 2;
    bufferStartedAt = undefined;
  }

  isMasterPaused.value = false;
  isViewerPaused.value = false;

  if (roomStore.isMaster) {
    if (isMasterInitiatedPlay) {
      await broadcastPlaybackState();
    }

    if (isPlayerInteractedWith.value) {
      return;
    }
  }

  await delay(1);

  setPlaybackState(roomStore.serverPlaybackState);
};

const onLiveStream = async () => {
  isPlayerInteractedWith.value = true;
  isMasterPaused.value = false;
  isViewerPaused.value = false;
};

const onPause = async (auto: boolean) => {
  if (auto) {
    return;
  }

  if (isPlayerInteractedWith.value) {
    if (roomStore.isMaster && contentInfo?.kind !== ContentKind.Livestream) {
      isMasterPaused.value = true;
    } else {
      isViewerPaused.value = true;
    }
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
    return roomStore.serverPlaybackState;
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
    await delay(1000);

    setPlaybackState(ps);
    return;
  }

  if (isViewerPaused.value || !isPlayerInteractedWith.value) {
    return;
  }

  // Don't try to control playback state of livestreams
  if (content.value?.is_livestream) {
    return;
  }

  const setTime = (newTime: number) => {
    bufferStartedAt = getTimestamp();

    // If video is playing, try to compensate
    // for buffering time.
    if (ps.is_playing) {
      newTime += lastBufferDuration;
    }

    _player.setTime(newTime);
  };

  const currentPlaybackState = await getPlaybackState();

  if (ps.is_playing) {
    const elapsedSinceTimestamp = ((getTimestamp() - roomStore.serverPlaybackStateTimestamp) * ps.rate) / 1000;
    const newTime = ps.time + elapsedSinceTimestamp;

    if (ps.rate !== currentPlaybackState.rate) {
      _player.setRate(ps.rate);
    }

    const allowedDivergence = Math.max(MAX_DIVERGENCE, lastBufferDuration);
    const timeDiff = Math.abs(currentPlaybackState.time - newTime);
    if (timeDiff > allowedDivergence) {
      console.log("Synchronizing to server time.", timeDiff);
      setTime(newTime);
    }

    if (!currentPlaybackState.is_playing) {
      setTime(newTime);

      if (isPlayerStateCooldown) {
        return;
      }

      _player.play();
      activatePlayerStateCooldown();
    }
  } else if (!ps.is_playing) {
    setTime(ps.time);
    isMasterPaused.value = true;

    if (currentPlaybackState.is_playing) {
      if (isPlayerStateCooldown) {
        return;
      }

      if (roomStore.isMaster) {
        return;
      }

      _player.pause();
    }
  }
};

const broadcastPlaybackState = async () => {
  if (isDetached.value || !isPlayerInteractedWith.value) {
    return;
  }

  const ps = await getPlaybackState();

  await roomStore.broadcastPlaybackState(ps);
};

const onContentAreaKeydown = (event: KeyboardEvent) => {
  if (event.key === "Tab" && !event.shiftKey) {
    toggleTheaterMode();
    event.preventDefault();
    return;
  }
};

const setMaster = (v: boolean) => {
  roomStore.setMaster(v);
  if (roomStore.isMaster) {
    isDetached.value = false;
  }
};

const toggleMaster = () => {
  setMaster(!roomStore.isMaster);
};

const toggleDetached = () => {
  isDetached.value = !isDetached.value;

  if (isDetached.value) {
    setMaster(false);
  }

  if (!isDetached.value) {
    setPlaybackState(roomStore.serverPlaybackState);
  }
};
</script>

<template>
  <div
    v-if="roomStore.isLoaded"
    ref="room"
    class="room"
    :class="{ 'right-side-chat': mainStore.settings.isRightSideChat }"
  >
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
          @click="mainStore.settings.isRightSideChat = !mainStore.settings.isRightSideChat"
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
        <button v-if="!roomStore.isAuthorized" class="usercontrol" title="Log In" @click="showLogIn">
          <i class="fa-solid fa-right-to-bracket"></i>
        </button>
        <div v-if="roomStore.isAuthorized" class="admin-controls usercontrol-group">
          <button class="usercontrol" title="Admin Panel" @click="showAdminPanel">
            <i class="fa-solid fa-gear"></i>
          </button>
          <button class="usercontrol" title="Set Content" @click="showRoomControls">
            <i class="fa-solid fa-video"></i>
          </button>
          <button
            class="usercontrol"
            :class="{ 'usercontrol-off': !roomStore.isMaster }"
            :disabled="!roomStore.isConnected"
            title="Toggle master"
            @click="toggleMaster"
          >
            <i class="fa-solid fa-star"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-show="!theaterMode" ref="chatContainer" class="chat-container">
      <Chat :class="{ 'right-side-chat': mainStore.settings.isRightSideChat }" @post="toastChat?.post($event)" />
    </div>
    <div ref="contentArea" class="content-area" @keydown="onContentAreaKeydown($event)">
      <div v-show="theaterMode" class="toast-chat-container">
        <ToastChat ref="toastChat" />
      </div>
      <div class="content-overlay">
        <div v-show="isMasterPaused" class="paused-text">PAUSED BY MASTER</div>
        <div v-show="isViewerPaused" class="paused-text">PAUSED BY YOU</div>
      </div>
      <Player
        ref="player"
        class="video-container"
        @contentloaded="isContentLoaded = true"
        @contenterror="isContentLoaded = false"
        @play="onPlay"
        @playing="onPlaying"
        @livestream="onLiveStream"
        @pause="onPause"
        @seek="onSeek"
        @ratechange="onRateChange"
      />
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
.room {
  display: flex;
  flex-direction: row;

  width: 100%;
  height: 100%;

  .chat-container {
    flex-shrink: 1;
    overflow: hidden;
  }

  .content-area {
    flex-grow: 1;
    overflow: hidden;

    // Needed to prevent children with absolute positioning from
    // ending up outside the parent.
    position: relative;

    .content-overlay {
      display: flex;
      align-items: center;
      justify-content: center;

      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;

      pointer-events: none;

      z-index: 999;
    }

    .paused-text {
      font-size: 1.8rem;
      font-weight: bold;
      letter-spacing: 0.4rem;
      text-shadow: 0 0 1rem white;
    }

    .video-container {
      background-color: black;
      height: 100%;
      width: 100%;
    }
  }

  // Landscape orientation
  @media screen and (min-aspect-ratio: 13/10) {
    .chat-container {
      border-right: 1px solid black;

      width: 350px;

      // Required because in Chrome, width is apparently not so much a rule
      // as a guideline that the browser might follow if it feels like it.
      min-width: 350px;
    }
  }

  // Portrait orientation
  @media screen and (max-aspect-ratio: 13/10) {
    flex-direction: column-reverse;

    .chat-container {
      border-top: 1px solid black;

      height: 50%;
    }

    .content-area {
      height: 50%;
    }
  }

  .usercontrols-activationzone {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    padding: 0 60px 60px 60px;

    z-index: 999;

    .usercontrols {
      display: flex;
      background: linear-gradient(#1d1d1d, #0c0c0c);
      transform: translateY(-95%);
      padding: 10px 10px 4px 10px;
      gap: 5px;

      opacity: 0.1;
      border-radius: 5px;

      transition:
        opacity 0.2s ease-out,
        transform 0.2s ease-in;

      button {
        background: none;
        border: none;
        padding: 0;

        cursor: pointer !important;
      }

      .usercontrol-group {
        display: flex;
        flex-direction: row;
        gap: 5px;
      }

      .usercontrol {
        color: #7a38e4;
        text-decoration: none;
        font-size: 1.5rem;

        &:disabled {
          color: black;
        }

        &:not(:disabled) {
          &:hover {
            color: #a862f8;
          }

          &.usercontrol-off {
            filter: brightness(0.6);
          }
        }
      }

      .spacer {
        background-color: #4e10b1;

        margin-left: 2px;
        margin-right: 2px;
        width: 4px;
      }
    }

    &:hover {
      .usercontrols {
        opacity: 1;
        transform: translateY(-15%);
        transition: transform 0.2s ease-out;
      }
    }
  }

  .admincontrols {
    position: absolute;
    left: 5px;
    top: 5px;

    opacity: 0;

    &:hover {
      opacity: 1;
    }
  }

  .toast-chat-container {
    position: absolute;
    left: 3vmin;
    bottom: 3vmin;

    width: 350px;

    z-index: 999;
    pointer-events: none;
    opacity: 0.8;
  }

  &.right-side-chat {
    flex-direction: row-reverse;

    .toast-chat-container {
      left: unset;
      right: 10px;
    }
  }
}

.admin-panel {
  width: min(665px, 100vw);
  height: min(500px, 100vh);
}
</style>
