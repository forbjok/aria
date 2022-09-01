<script setup lang="ts">
import { inject, onMounted, ref } from "vue";

import type { RoomAdminService } from "@/services/roomadminservice";

import "@/styles/roomcontrols.scss";

const roomAdminService: RoomAdminService | undefined = inject("admin");

const initialized = ref(false);
const authorized = ref(false);
const contentUrl = ref("");

const password = ref("");
const loginError = ref<string | null>(null);

onMounted(async () => {
  authorized.value = (await roomAdminService?.getLoginStatus()) || false;
  initialized.value = true;
});

const login = async () => {
  const success = await roomAdminService?.login(password.value);

  if (success) {
    authorized.value = true;
  } else {
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
    if (contentUrl.value.indexOf(":") === -1) {
      // No scheme was present - assume HTTP
      contentUrl.value = "http://" + contentUrl.value;
    }

    await roomAdminService?.setContentUrl(contentUrl.value);
    contentUrl.value = "";
  }
};
</script>

<template>
  <div v-if="initialized" class="roomcontrols">
    <div v-if="!authorized" class="login">
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
    <div v-if="authorized" class="controls">
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

<style scoped></style>
