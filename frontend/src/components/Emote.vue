<script setup lang="ts">
import { ref, toRefs } from "vue";

import type { Emote } from "@/models";

const props = defineProps<{
  emote: Emote;
}>();

const { emote } = toRefs(props);

const expandImage = ref(false);

const toggleExpanded = (): void => {
  expandImage.value = !expandImage.value;
};
</script>

<template>
  <img
    class="emote"
    :class="expandImage ? 'expanded' : ''"
    :src="emote.url"
    :title="`!${emote.name}`"
    @click="toggleExpanded"
  />
</template>

<style scoped lang="scss">
@use "@/styles/emote.scss" as *;
</style>
