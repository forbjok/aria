<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
import { toRefs } from "vue";

const props = defineProps<{
  show: boolean;
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
  <div class="modal" v-if="show" @click.stop="clickOutside">
    <div class="content" @click.stop>
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal {
  background-color: rgba(0, 0, 0, 0.2);

  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  z-index: 999;
}

.content {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translateX(-50%) translateY(-50%);

  overflow: hidden;
}
</style>
