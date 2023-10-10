<script setup lang="ts">
import { ref } from "vue";

import Player from "./Player.vue";

import { useRoomStore } from "@/stores/room";
import { ContentKind, getContentInfo } from "@/utils/content";

const emit = defineEmits<{
  (e: "set-content", url: string): void;
}>();

const roomStore = useRoomStore();

const contentUrl = ref("");
const loadContentUrl = ref<string>();

const player = ref<typeof Player>();

const setContent = async () => {
  if (contentUrl.value) {
    loadContentUrl.value = contentUrl.value;

    const contentInfo = getContentInfo(loadContentUrl.value);
    if (!contentInfo) return;

    if (contentInfo.kind === ContentKind.Video) {
      player.value?.setContent(contentInfo);
    } else if (contentInfo.kind === ContentKind.Stream) {
      const url = contentUrl.value;

      await roomStore.setContent(url);
      contentUrl.value = "";

      emit("set-content", url);
    }
  }
};

const onLoadedMetadata = async () => {
  const url = loadContentUrl.value!;

  const duration = await player.value?.getDuration();

  await roomStore.setContent(url, duration);
  contentUrl.value = "";

  emit("set-content", url);
};
</script>

<template>
  <div class="room-controls">
    <div class="content-section">
      <form class="set-content-form" @submit.prevent="setContent">
        <label>Content URL</label>
        <input type="text" name="url" placeholder="Url" v-model="contentUrl" :disabled="!!loadContentUrl" />
        <button type="submit" name="submit" :disabled="!!loadContentUrl">Set</button>
      </form>
      <div v-show="loadContentUrl" class="status-text">Setting content...</div>
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
