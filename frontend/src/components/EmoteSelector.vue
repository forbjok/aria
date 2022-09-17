<script setup lang="ts">
import { computed, inject } from "vue";

import type { Emote } from "@/models";
import type { RoomService } from "@/services/room";

const emit = defineEmits<{
  (e: "selectemote", name: string): void;
}>();

const room: RoomService | undefined = inject("room");

const emotes = computed((): Emote[] => {
  if (!room) {
    return [];
  }

  return Object.keys(room.emotes.value)
    .sort()
    .map((n) => room.emotes.value[n]);
});

const selectEmote = (emote: Emote) => {
  emit("selectemote", emote.name);
};
</script>

<template>
  <div class="emote-selector">
    <div class="emotes">
      <div v-for="e of emotes" :key="e.name" :value="e.name" class="emote">
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
