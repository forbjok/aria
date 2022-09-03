<script setup lang="ts">
import { toRefs } from "vue";

import Room from "@/components/Room.vue";

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);
</script>

<template>
  <main>
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
