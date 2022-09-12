<script setup lang="ts">
import { inject, ref } from "vue";

import type { RoomAdminService } from "@/services/room-admin";
import type { RoomAuthService } from "@/services/room-auth";

const auth: RoomAuthService | undefined = inject("auth");
const admin: RoomAdminService | undefined = inject("admin");

const contentUrl = ref("");

const password = ref("");
const loginError = ref<string | null>(null);

const login = async () => {
  const success = await auth?.login(password.value);
  if (!success) {
    loginError.value = "Nope, that's not it.";

    setTimeout(() => {
      loginError.value = "";
    }, 2000);
  }

  password.value = "";
  return success;
};

const setContent = async () => {
  if (contentUrl.value) {
    await admin?.setContentUrl(contentUrl.value);
    contentUrl.value = "";
  }
};
</script>

<template>
  <div class="roomcontrols">
    <div v-if="!auth?.isAuthorized.value" class="login">
      <form class="login-form" @submit.prevent="login()">
        <table>
          <tr>
            <td>Password</td>
            <td>
              <input type="password" name="password" v-model="password" />
            </td>
            <td>
              <button type="submit" name="submit"><span class="fa fa-unlock"></span></button>
            </td>
          </tr>
        </table>
      </form>
      <div class="login-error">{{ loginError }}</div>
    </div>
    <div v-if="auth?.isAuthorized.value" class="controls">
      <div class="content-section">
        <form class="setcontent-form" @submit.prevent="setContent()">
          <table>
            <tr>
              <td>Content URL</td>
              <td>
                <input type="text" name="url" v-model="contentUrl" />
              </td>
              <td>
                <button type="submit" name="submit">Set</button>
              </td>
            </tr>
          </table>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/roomcontrols.scss" as *;
</style>
