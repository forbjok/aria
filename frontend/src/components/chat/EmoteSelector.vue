<script setup lang="ts">
import { computed } from "vue";

import { useRoomStore } from "@/stores/room";

import type { Emote } from "@/models";

const emit = defineEmits<{
  (e: "selectemote", name: string): void;
}>();

const roomStore = useRoomStore();

const emotes = computed((): Emote[] => {
  return Object.keys(roomStore.emotes)
    .sort()
    .map((n) => roomStore.emotes[n]);
});

const selectEmote = (emote: Emote) => {
  emit("selectemote", emote.name);
};
</script>

<template>
  <div class="emote-selector">
    <div class="emotes-container">
      <div class="emotes">
        <div v-for="e of emotes" :key="e.name" :value="e.name" class="emote">
          <div class="emote">
            <img :src="e.url" :title="e.name" @click.stop="selectEmote(e)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/emote-selector.scss" as *;
</style>
