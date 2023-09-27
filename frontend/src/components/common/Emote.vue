<script setup lang="ts">
import { computed, toRefs } from "vue";

import type { Emote } from "@/models";

const props = defineProps<{
  emote: Emote;
}>();

const { emote } = toRefs(props);

const isVideo = computed(() => emote.value?.url.endsWith(".webm"));
</script>

<template>
  <div class="emote">
    <img v-if="!isVideo" :src="emote.url" />
    <video v-if="isVideo" :src="emote.url" autoplay loop muted></video>
  </div>
</template>

<style scoped lang="scss">
.emote {
  display: inline-block;

  max-width: inherit;
  max-height: inherit;

  img,
  video {
    max-width: inherit;
    max-height: inherit;
  }
}
</style>
