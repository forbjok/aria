<script setup lang="ts">
import { ref, toRefs } from "vue";

import Modal from "./Modal.vue";

const props = defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: "closed"): void;
}>();

const { title } = toRefs(props);

const isOpen = ref(false);

const show = () => {
  isOpen.value = true;
};

const close = () => {
  if (!isOpen.value) {
    return;
  }

  isOpen.value = false;
  emit("closed");
};

defineExpose({
  show,
  close,
});
</script>

<template>
  <Modal :show="isOpen" @clickoutside="close">
    <div class="dialog">
      <div class="title">{{ title }}</div>
      <div class="content">
        <slot></slot>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
@use "@/styles/dialog.scss" as *;

.dialog {
  background-color: var(--color-dialog-background);
  border: 1px solid black;

  display: flex;
  flex-direction: column;

  width: 100%;
  height: 100%;

  overflow: hidden;

  .title {
    flex-shrink: 0;

    background-color: var(--color-title-background);

    padding: 4px 10px;

    cursor: default;
  }

  .content {
    flex-grow: 1;
  }
}
</style>
