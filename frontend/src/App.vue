<script setup lang="ts">
import { onBeforeMount, ref } from "vue";
import { RouterView } from "vue-router";

import { useMainStore } from "@/stores/main";

const isInitialized = ref(false);
const isLoading = ref(true);
const errorMessage = ref<string>();

const mainStore = useMainStore();

onBeforeMount(async () => {
  try {
    await mainStore.initialize();

    isInitialized.value = true;
  } catch (err) {
    errorMessage.value = err as string;
  }

  isLoading.value = false;
});
</script>

<template>
  <RouterView v-if="isInitialized" />
  <div v-if="!isInitialized" class="loading">
    <div v-show="isLoading" class="loading-text">LOADING</div>
    <div v-show="errorMessage" class="error-text">{{ errorMessage }}</div>
  </div>
</template>

<style scoped lang="scss">
.loading {
  font-size: 1.4rem;

  padding: 2rem;

  text-align: center;

  .loading-text {
    color: white;
  }

  .error-text {
    color: red;
  }
}
</style>
