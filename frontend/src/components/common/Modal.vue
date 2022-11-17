<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
import { toRefs } from "vue";

import { useMainStore } from "@/stores/main";

const props = defineProps<{
  show: boolean;
  darken?: boolean;
}>();

const emit = defineEmits<{
  (e: "clickoutside"): void;
}>();

const { show } = toRefs(props);

const mainStore = useMainStore();

const clickOutside = () => {
  emit("clickoutside");
};
</script>

<template>
  <Teleport to="#overlay">
    <div
      v-if="show"
      class="modal"
      :class="[{ darken: darken }, `theme-${mainStore.settings.theme}`]"
      @click.stop="clickOutside"
    >
      <div class="content" v-bind="$attrs" @click.stop>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/theme/dark.scss" as *;
@use "@/styles/theme/yotsubab.scss" as *;

.modal {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  z-index: 999;

  &.darken {
    background-color: rgba(0, 0, 0, 0.2);
  }
}

.content {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translateX(-50%) translateY(-50%);

  overflow: hidden;
}
</style>
