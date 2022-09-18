<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
import { toRefs } from "vue";

const props = defineProps<{
  show: boolean;
  darken?: boolean;
}>();

const emit = defineEmits<{
  (e: "clickoutside"): void;
}>();

const { show } = toRefs(props);

const clickOutside = () => {
  emit("clickoutside");
};
</script>

<template>
  <Teleport to="#overlay">
    <div class="modal" :class="darken ? 'darken' : ''" v-if="show" @click.stop="clickOutside">
      <div class="content" v-bind="$attrs" @click.stop>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
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
