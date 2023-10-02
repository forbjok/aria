<script setup lang="ts">
import { onBeforeMount } from "vue";
import { RouterView } from "vue-router";

import { useMainStore } from "@/stores/main";

const mainStore = useMainStore();

onBeforeMount(async () => {
  await mainStore.initialize();
});
</script>

<template>
  <RouterView />
</template>

<style scoped lang="scss"></style>
