<script setup lang="ts"></script>

<template>
  <div class="toolbar">
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  flex-shrink: 0;

  background-color: var(--color-toolbar-background);

  display: flex;
  flex-direction: row;
  gap: 5px;

  width: 100%;

  padding: 2px;
}
</style>
