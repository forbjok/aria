<script setup lang="ts">
import { onBeforeMount, ref, toRefs } from "vue";

import router from "@/router";
import type { RoomInfo } from "@/models";
import { LocalRoomAuthService } from "@/services/localroomauthservice";
import { RoomService, type ClaimInfo } from "@/services/room";

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);

const roomInfo: RoomInfo = { name: room.value };

const auth = new LocalRoomAuthService(roomInfo);
const roomService = new RoomService(roomInfo);

const claimInfo = ref<ClaimInfo | null>(null);
const claimError = ref<string | null>(null);

const claim = async () => {
  try {
    const data = await roomService.claim();

    claimInfo.value = data;
    auth.set(data.token);
  } catch (err: any) {
    claimError.value = err || "";
  }
};

const enterRoom = () => {
  router.push({ name: "room", params: { name: roomInfo.name } });
};

onBeforeMount(async () => {
  const roomExists = await roomService.exists();

  if (roomExists) {
    enterRoom();
  }
});
</script>

<template>
  <div class="claim">
    <div v-if="!claimInfo" class="unclaimed">
      <p class="unclaimed-text">This room has not yet been claimed.</p>
      <button type="button" name="claim" class="claim-button" @click="claim()">Claim</button>
    </div>
    <div v-if="claimInfo" class="claim-result">
      <div class="claim-result-text">
        <div class="claimed-text">You have claimed /{{ claimInfo.name }}/.</div>
        <div class="password-text">
          The password is: <span class="password">{{ claimInfo.password }}</span>
        </div>
      </div>
      <button type="button" name="enter" class="enter-button" @click="enterRoom()">Enter</button>
    </div>
    <div v-if="claimError" class="claim-error">
      <p>An error occurred claiming the room: {{ claimError }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import "@/styles/claim.scss";
</style>
