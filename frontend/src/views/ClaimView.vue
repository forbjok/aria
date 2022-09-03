<script setup lang="ts">
import { toRefs } from "vue";

import Claim from "@/components/Claim.vue";

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);
</script>

<template>
  <main>
    <Claim :room="room" class="claim" />
  </main>
</template>

<style scoped lang="scss">
main {
  background: #eef2ff;

  padding-top: 20px;

  width: 100%;
  height: 100%;
}
</style>
