import { defineStore } from "pinia";
import { ref } from "vue";
import { useStorage } from "@vueuse/core";
import axios from "axios";

import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import type { SysConfig } from "@/models";

interface NewUserResponse {
  user_id: number;
  token: string;
}

export const useMainStore = defineStore("main", () => {
  const settings = useStorage<Settings>("aria_settings", DEFAULT_SETTINGS);
  let userToken: string | null;

  const sysConfig = ref<SysConfig>();

  async function fetchSysConfig() {
    const res = await axios.get<SysConfig>("/api/sys/config");

    sysConfig.value = res.data;
  }

  async function getUser() {
    if (!userToken) {
      userToken = localStorage.getItem("aria_user");
      if (userToken) {
        try {
          await axios.post<number>(`/api/user/verify`, null, {
            headers: {
              "X-User": userToken,
            },
          });
        } catch {
          userToken = null;
        }
      }

      if (!userToken) {
        try {
          const res = await axios.post<NewUserResponse>(`/api/user/new`);

          userToken = res.data.token;
          localStorage.setItem("aria_user", userToken);
        } catch {
          userToken = null;
        }
      }
    }

    return userToken;
  }

  async function initialize() {
    await fetchSysConfig();
  }

  const initializePromise = initialize();

  async function isInitialized() {
    await initializePromise;
  }

  return {
    sysConfig,
    settings,
    getUser,
    isInitialized,
  };
});
