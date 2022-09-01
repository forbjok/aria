<script setup lang="ts">
import { toRefs } from "vue";

import Claim from "@/components/Claim.vue";

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);
</script>

<template>
  <main>
    <Claim :room="name" class="claim" />
  </main>
</template>

<style scoped lang="scss">
:global(body) {
  background: #eef2ff;
}
</style>
