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
    :class="{ expanded: expandImage }"
    :src="emote.url"
    :title="`!${emote.name}`"
    @click="toggleExpanded"
  />
</template>

<style scoped lang="scss">
.emote {
  cursor: pointer;

  &:not(.expanded) {
    max-height: 100px;

    @media screen and (orientation: portrait) {
      max-height: 50px;
    }
  }

  &.expanded {
    max-width: 100%;
  }
}
</style>
