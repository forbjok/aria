<script setup lang="ts">
import { inject, ref } from "vue";

import type { RoomAdminService } from "@/services/room-admin";

const emit = defineEmits<{
  (e: "set-content", url: string): void;
}>();

const admin = inject<RoomAdminService>("admin")!;

const contentUrl = ref("");

const setContent = async () => {
  if (contentUrl.value) {
    const url = contentUrl.value;

    await admin.setContentUrl(url);
    contentUrl.value = "";

    emit("set-content", url);
  }
};
</script>

<template>
  <div class="room-controls">
    <div class="content-section">
      <form class="set-content-form" @submit.prevent="setContent">
        <label>Content URL</label>
        <input type="text" name="url" placeholder="Url" v-model="contentUrl" />
        <button type="submit" name="submit">Set</button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.room-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;

  padding: 16px;
}

.set-content-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}
</style>
