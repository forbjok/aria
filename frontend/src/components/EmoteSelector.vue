<script setup lang="ts">
import { inject } from "vue";

import type { Emote, RoomInfo } from "@/models";

const emit = defineEmits<{
  (e: "selectemote", name: string): void;
}>();

const room: RoomInfo | undefined = inject("room");

const selectEmote = (emote: Emote) => {
  emit("selectemote", emote.name);
};
</script>

<template>
  <div class="emote-selector">
    <div class="emotes">
      <div v-for="e of room?.emotes" :key="e.name" :value="e.name" class="emote">
        <div class="emote">
          <img :src="e.url" :title="e.name" @click.stop="selectEmote(e)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/emote-selector.scss" as *;
</style>
