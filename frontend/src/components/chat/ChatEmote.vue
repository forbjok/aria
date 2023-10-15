<script setup lang="ts">
import { ref, toRefs } from "vue";

import type { Emote } from "@/models";

import Image from "@/components/common/Image.vue";

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
  <Image
    class="chat-emote"
    :src="emote.url"
    :class="{ expanded: expandImage }"
    :title="`!${emote.name}`"
    @click="toggleExpanded"
  />
</template>

<style scoped lang="scss">
.chat-emote {
  display: inline-block;

  // Prevent line spacing between emotes
  vertical-align: bottom;

  cursor: pointer;

  &:not(.expanded) {
    max-height: 100px;

    // Portrait orientation
    @media screen and (max-aspect-ratio: 13/10) {
      max-height: 50px;
    }
  }

  &.expanded {
    max-width: 100%;
  }
}
</style>
