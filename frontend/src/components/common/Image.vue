<script setup lang="ts">
import { computed, toRefs } from "vue";

const props = defineProps<{
  src: string;
}>();

const { src } = toRefs(props);

const isVideo = computed(() => src.value?.endsWith(".webm"));
</script>

<template>
  <div class="image">
    <img v-if="!isVideo" :src="src" />
    <video v-if="isVideo" :src="src" autoplay loop muted></video>
  </div>
</template>

<style scoped lang="scss">
.image {
  display: block;

  max-width: inherit;
  max-height: inherit;

  img,
  video {
    display: block;

    max-width: inherit;
    max-height: inherit;
  }
}
</style>
