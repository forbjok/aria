<script setup lang="ts">
import { ref, toRefs } from "vue";
import { useRouter } from "vue-router";

import { type ClaimInfo, useRoomStore } from "@/stores/room";

const props = defineProps<{
  room: string;
}>();

const emit = defineEmits<(e: "enter", room: string) => void>();

const { room } = toRefs(props);

const router = useRouter();

const roomStore = useRoomStore();

const claimInfo = ref<ClaimInfo>();
const claimError = ref<string>();

const claim = async () => {
  try {
    claimInfo.value = await roomStore.claimRoom(room.value);
  } catch (err: any) {
    claimError.value = err || "";
  }
};

const enterRoom = () => {
  emit("enter", room.value);
};
</script>

<template>
  <div class="claim">
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
.claim {
  font-size: 1.5rem;

  color: black;

  text-align: center;

  button {
    border-radius: 3px;
  }

  .unclaimed-text {
    margin: 10px;
  }

  .claim-button {
    font-size: 2rem;
  }

  .enter-button {
    font-size: 2rem;
  }

  .claim-result {
    .proceed-button {
      font-size: 2rem;
    }

    .password {
      text-decoration: underline;
    }

    .claim-result-text {
      padding: 20px;
    }
  }

  .claim-error {
    font-size: 1.5rem;
    color: red;
  }
}
</style>
