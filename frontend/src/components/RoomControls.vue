<script setup lang="ts">
import { inject, ref } from "vue";

import type { RoomAdminService } from "@/services/room-admin";

const admin: RoomAdminService | undefined = inject("admin");

const contentUrl = ref("");

const setContent = async () => {
  if (contentUrl.value) {
    await admin?.setContentUrl(contentUrl.value);
    contentUrl.value = "";
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
