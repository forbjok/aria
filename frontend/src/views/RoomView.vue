<script setup lang="ts">
import { toRefs } from "vue";

import Room from "@/components/Room.vue";

import { useMainStore } from "@/stores/main";

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);

const mainStore = useMainStore();
</script>

<template>
  <main :class="`theme-${mainStore.settings.theme}`">
    <Room :name="name" />
  </main>
</template>

<style scoped lang="scss">
main {
  background: black;

  width: 100%;
  height: 100%;
}
</style>
