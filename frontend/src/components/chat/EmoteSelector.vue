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
.emote-selector {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  overflow: hidden;
}

// This might seem a bit redundant, but it's part of an elaborate
// workaround for a CSS bug (or possibly just retarded design choice)
// causing %-based height to be ignored if the parent is using max-height.
// So, instead of just putting max-height on the main element and
// having .emotes with height 100%, we have to do this stupid shit.
.emotes-container {
  flex-grow: 0;
  flex-shrink: 1;

  display: flex;
  flex-direction: column;

  background-color: rgba(0, 0, 0, 0.8);

  overflow: hidden;

  width: 100%;
}

.emotes {
  flex-grow: 1;

  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 5px;

  padding: 10px;

  overflow-x: hidden;
  overflow-y: auto;

  .emote {
    background-color: rgb(13, 13, 13);
    display: flex;
    justify-content: center;

    width: 100px;
    height: 100px;

    cursor: pointer;

    img {
      align-self: center;

      max-width: 100px;
      max-height: 100px;
    }
  }
}
</style>
