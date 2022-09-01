<script setup lang="ts">
import { ref, toRefs } from "vue";

import "@/styles/claim.scss";
import axios from "axios";
import { LocalRoomAuthService } from "@/services/localroomauthservice";

import router from "@/router";
import type { RoomInfo } from "@/models";

interface ClaimInfo {
  name: string;
  password: string;
  token: string;
}

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);

const roomInfo: RoomInfo = { name: room.value };
const auth = new LocalRoomAuthService(roomInfo);

const claimInfo = ref<ClaimInfo | null>(null);
const claimError = ref<string | null>(null);

const claim = async () => {
  try {
    const response = await axios.post(`/api/r/${room.value}/claim`, null, {
      headers: {
        Accept: "application/json",
      },
    });
    const data: ClaimInfo = await response.data;

    claimInfo.value = data;
    auth.set(data.token);
  } catch (err: any) {
    claimError.value = err || ""; //response.data.statusText;
  }
};

const enterRoom = () => {
  router.push({ name: "room", params: { name: room.value } });
};
</script>

<template>
  <div class="claim">
    <div v-if="!claimInfo" class="unclaimed-text">
      <p>This room has not yet been claimed.</p>
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

<style scoped></style>
