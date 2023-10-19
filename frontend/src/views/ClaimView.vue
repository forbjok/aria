<script setup lang="ts">
import { onBeforeMount, ref, toRefs } from "vue";
import { useRouter } from "vue-router";

import Claim from "@/components/Claim.vue";
import Loading from "@/components/common/Loading.vue";

import { useRoomStore } from "@/stores/room";

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);

const roomStore = useRoomStore();

const router = useRouter();

const isLoading = ref(true);
const isLoaded = ref(false);

onBeforeMount(async () => {
  try {
    await roomStore.loadRoom(room.value);
    if (roomStore.loadError) return;

    if (roomStore.exists) {
      router.push({ name: "room", params: { name: roomStore.name } });
      return;
    }

    isLoaded.value = true;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <main>
    <Claim v-if="isLoaded" :room="room" class="claim" />
    <Loading v-if="!isLoaded" class="loading" :is-loading="isLoading" :error-message="roomStore.loadError" />
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
