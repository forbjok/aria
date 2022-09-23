<script setup lang="ts">
import { onMounted, ref, toRefs } from "vue";

import router from "@/router";

import { RoomAuthService } from "@/services/room-auth";
import { RoomService, type ClaimInfo } from "@/services/room";

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);

const isRoomLoaded = ref(false);

const roomService = new RoomService(room.value);
const auth = new RoomAuthService(roomService);

const claimInfo = ref<ClaimInfo>();
const claimError = ref<string>();

const claim = async () => {
  try {
    const data = await roomService.claim();

    claimInfo.value = data;
    await auth.setAuth(data.auth);
  } catch (err: any) {
    claimError.value = err || "";
  }
};

const enterRoom = () => {
  router.push({ name: "room", params: { name: roomService.name } });
};

onMounted(async () => {
  await roomService.setup();

  if (roomService.exists()) {
    enterRoom();
    return;
  }

  isRoomLoaded.value = true;
});
</script>

<template>
  <div v-if="isRoomLoaded" class="claim">
    <div v-if="!claimInfo" class="unclaimed">
      <p class="unclaimed-text">This room has not yet been claimed.</p>
      <button type="button" name="claim" class="claim-button" @click="claim">Claim</button>
    </div>
    <div v-if="claimInfo" class="claim-result">
      <div class="claim-result-text">
        <div class="claimed-text">You have claimed /{{ claimInfo.name }}/.</div>
        <div class="password-text">
          The password is: <span class="password">{{ claimInfo.password }}</span>
        </div>
      </div>
      <button type="button" name="enter" class="enter-button" @click="enterRoom">Enter</button>
    </div>
    <div v-if="claimError" class="claim-error">
      <p>An error occurred claiming the room: {{ claimError }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/claim.scss" as *;
</style>
