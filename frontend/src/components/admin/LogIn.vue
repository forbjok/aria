<script setup lang="ts">
import { inject, ref } from "vue";

import type { RoomAuthService } from "@/services/room-auth";

const auth: RoomAuthService | undefined = inject("auth");

const password = ref("");
const errorText = ref<string>();

const logIn = async () => {
  const success = await auth?.login(password.value);
  if (!success) {
    errorText.value = "Nope, that's not it.";
  }

  password.value = "";
  return success;
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
