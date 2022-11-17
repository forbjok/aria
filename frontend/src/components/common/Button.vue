<script setup lang="ts"></script>

<template>
  <button>
    <slot></slot>
  </button>
</template>

<style scoped lang="scss">
button {
  border: none;
  color: var(--color-button-text);
  background-color: var(--color-button-background);

  padding: 5px;

  &:enabled {
    cursor: pointer !important;
  }

  &:hover {
    color: var(--color-button-hover);
    cursor: pointer;
  }
}
</style>
