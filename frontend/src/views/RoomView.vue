<script setup lang="ts">
import { onBeforeMount, ref, toRefs } from "vue";
import { useRouter } from "vue-router";

import Loading from "@/components/common/Loading.vue";
import Room from "@/components/Room.vue";

import { useMainStore } from "@/stores/main";
import { useRoomStore } from "@/stores/room";

const props = defineProps<{
  name: string;
}>();

const { name } = toRefs(props);

const mainStore = useMainStore();
const roomStore = useRoomStore();

const router = useRouter();

const isLoading = ref(true);

onBeforeMount(async () => {
  try {
    await roomStore.isInitialized();

    await roomStore.loadRoom(name.value);
    if (roomStore.loadError) return;

    if (!roomStore.exists) {
      router.push({ name: "claim", params: { room: name.value } });
      return;
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <main :class="`theme-${mainStore.settings.theme}`">
    <Room v-if="roomStore.isLoaded" :name="name" />
    <Loading v-if="!roomStore.isLoaded" class="loading" :is-loading="isLoading" :error-message="roomStore.loadError" />
  </main>
</template>

<style scoped lang="scss">
main {
  background: black;

  width: 100%;
  height: 100%;
}
</style>
