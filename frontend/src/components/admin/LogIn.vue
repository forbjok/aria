<script setup lang="ts">
import { ref } from "vue";

import { useRoomStore } from "@/stores/room";

const emit = defineEmits<{
  (e: "logged-in"): void;
}>();

const roomStore = useRoomStore();

const password = ref("");
const errorText = ref<string>();

const logIn = async () => {
  const success = await roomStore.login(password.value);
  password.value = "";

  if (success) {
    emit("logged-in");
  } else {
    errorText.value = "Nope, that's not it.";
  }
};
</script>

<template>
  <div class="log-in">
    <form class="login-form" @submit.prevent="logIn">
      <label>Password</label>
      <input type="password" name="password" placeholder="" v-model="password" />
      <button type="submit" name="submit"><span class="fa fa-unlock"></span></button>
    </form>
    <div class="error-text">{{ errorText }}</div>
  </div>
</template>

<style scoped lang="scss">
.log-in {
  display: flex;
  flex-direction: column;
  gap: 10px;

  padding: 16px;
}

.login-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.error-text {
  color: red;
  font-weight: bold;
}
</style>
