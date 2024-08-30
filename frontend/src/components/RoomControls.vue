<script setup lang="ts">
import { ref } from "vue";

import Button from "@/components/common/Button.vue";
import Dialog from "@/components/common/Dialog.vue";
import Toolbar from "@/components/common/Toolbar.vue";

import Player from "./Player.vue";

import { useRoomStore } from "@/stores/room";
import { ContentKind, getContentInfo, type ContentInfo } from "@/utils/content";

const emit = defineEmits<{
  (e: "set-content", url: string): void;
}>();

const roomStore = useRoomStore();

const contentUrl = ref("");
const loadContentInfo = ref<ContentInfo>();
const statusText = ref<string>();

const addLivestreamOrVodDialog = ref<typeof Dialog>();
const player = ref<typeof Player>();

let cancelTimeout: number | undefined = undefined;

const setContent = async () => {
  if (!contentUrl.value) return;

  const contentInfo = getContentInfo(contentUrl.value);
  if (!contentInfo) return;

  loadContentInfo.value = contentInfo;

  if (contentInfo.kind === ContentKind.Video) {
    await addVideo();
  } else if (contentInfo.kind === ContentKind.Livestream) {
    await addLivestream();
  } else if (contentInfo.kind === ContentKind.LivestreamOrVod) {
    addLivestreamOrVodDialog.value?.show();
  }
};

const onLoadedMetadata = async () => {
  if (cancelTimeout) clearTimeout(cancelTimeout);

  const url = loadContentInfo.value!.url;

  const duration = await player.value?.getDuration();

  await roomStore.setContent(url, { duration });
  contentUrl.value = "";

  clearStatus();
  emit("set-content", url);
};

const addLivestream = async () => {
  addLivestreamOrVodDialog.value?.close();

  const url = loadContentInfo.value!.url;

  await roomStore.setContent(url, { isLivestream: true });
  contentUrl.value = "";

  clearStatus();
  emit("set-content", url);
};

const addVideo = async () => {
  addLivestreamOrVodDialog.value?.close();

  statusText.value = "Retrieving content metadata...";
  player.value?.setContent(loadContentInfo.value);

  cancelTimeout = setTimeout(() => {
    clearStatus();

    statusText.value = "Unable to retrieve content metadata.";
  }, 10 * 1000);
};

const clearStatus = () => {
  statusText.value = undefined;
  loadContentInfo.value = undefined;
  player.value?.setContent(undefined);
};
</script>

<template>
  <div class="room-controls">
    <Dialog ref="addLivestreamOrVodDialog" title="Livestream or VOD?">
      <div class="livestream-or-vod-dialog">
        <div class="content">Is this content a livestream or a VOD?</div>
        <Toolbar class="choices">
          <Button @click="addLivestream">Livestream</Button>
          <Button @click="addVideo">VOD</Button>
        </Toolbar>
      </div>
    </Dialog>

    <div class="content-section">
      <form class="set-content-form" @submit.prevent="setContent">
        <label>Content URL</label>
        <input type="text" name="url" placeholder="Url" v-model="contentUrl" :disabled="!!loadContentInfo" />
        <button type="submit" name="submit" :disabled="!!loadContentInfo">Set</button>
      </form>
      <div v-show="statusText" class="status-text">{{ statusText }}</div>
    </div>
  </div>
  <!-- Hidden player used to retrieve duration -->
  <Player ref="player" class="player" @contentloaded="onLoadedMetadata" />
</template>

<style scoped lang="scss">
.room-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;

  padding: 16px;
}

.livestream-or-vod-dialog {
  .content {
    flex-grow: 1;

    padding: 10px;
  }
}

.content-section {
  display: flex;
  flex-direction: column;
}

.set-content-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.status-text {
  margin-top: 0.4rem;
}

.player {
  display: none;
}
</style>
