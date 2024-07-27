<script setup lang="ts">
import { onBeforeMount, ref } from "vue";
import { RouterView } from "vue-router";

import { useMainStore } from "@/stores/main";

import Loading from "@/components/common/Loading.vue";

const isInitialized = ref(false);
const isLoading = ref(true);
const errorMessage = ref<string>();

const mainStore = useMainStore();

onBeforeMount(async () => {
  try {
    await mainStore.isInitialized();

    isInitialized.value = true;
  } catch (err) {
    errorMessage.value = err as string;
  }

  isLoading.value = false;
});
</script>

<template>
  <RouterView v-if="isInitialized" />
  <Loading v-if="!isInitialized" class="loading" :is-loading="isLoading" :error-message="errorMessage" />
</template>

<style scoped lang="scss"></style>
