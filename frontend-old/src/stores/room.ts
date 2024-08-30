import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import axios, { AxiosError, type AxiosProgressEvent, type RawAxiosRequestHeaders } from "axios";

import { useMainStore } from "./main";

import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/settings";
import type { Content, Emote, Room } from "@/models";
import { AriaWebSocket } from "@/services/websocket";
import { getTimestamp } from "@/utils/timestamp";
import { tryParseJson } from "@/utils/json";

export interface ClaimRequest {
  name: string;
}

export interface ClaimInfo {
  id: number;
  name: string;
  password: string;
  auth: LoginResponse;
}

export interface LoginResponse {
  access_token: string;
  exp: number;
  refresh_token: string;
}

export interface NewEmote {
  name: string;
  image?: File;
}

export interface PlaybackState {
  time: number;
  rate: number;
  is_playing: boolean;
}

export const useRoomStore = defineStore("room", () => {
  const mainStore = useMainStore();

  const isLoaded = ref(false);
  const loadError = ref("");

  const name = ref<string>();
  const id = ref(0);
  const auth = ref<LoginResponse>();
  const settings = ref<RoomSettings>(DEFAULT_ROOM_SETTINGS);

  const content = ref<Content>();
  const isConnected = ref(false);
  const isMaster = ref(false);

  const serverPlaybackStateTimestamp = ref(0);
  const serverPlaybackState = ref<PlaybackState>({
    time: 0,
    rate: 1,
    is_playing: false,
  });

  const exists = computed(() => id.value > 0);
  const authKey = computed(() => (name.value ? `aria_room_${name.value}_auth` : undefined));
  const settingsKey = computed(() => (name.value ? `aria_room_${name.value}_settings` : undefined));
  const isAuthorized = computed(() => !!auth.value?.access_token);

  const emotes = ref<Record<string, Emote>>({});

  var ws: AriaWebSocket = undefined!; // Will be set in initialize()

  watch(auth, (value) => {
    if (!authKey.value) {
      return;
    }

    localStorage.setItem(authKey.value, JSON.stringify(value || {}));
  });

  watch(
    settings,
    (value) => {
      if (!settingsKey.value) {
        return;
      }

      localStorage.setItem(settingsKey.value, JSON.stringify(value || {}));
    },
    { deep: true },
  );

  async function claimRoom(_name: string) {
    const req: ClaimRequest = { name: _name };
    const res = await axios.post<ClaimInfo>(`/api/r/claim`, req);
    const data = await res.data;

    name.value = data.name;
    id.value = data.id;
    auth.value = data.auth;

    await loadRoomSettings();

    return data;
  }

  async function loadRoom(_name: string) {
    name.value = _name;

    try {
      const res = await axios.get<Room>(`/api/r/room/${name.value}`);

      id.value = res.data.id;

      isLoaded.value = true;
    } catch (_err: any) {
      const err = _err as AxiosError;

      if (err.response?.status === 404) return;

      name.value = undefined;
      id.value = 0;

      isLoaded.value = false;
      loadError.value = err.message;
      return;
    }

    await loadRoomAuth();
    await loadRoomSettings();

    await verifyLogin();

    ws.connect();
  }

  async function loadRoomAuth() {
    if (!authKey.value) {
      return;
    }

    const _auth = localStorage.getItem(authKey.value);

    auth.value = tryParseJson(_auth, undefined);
  }

  async function loadRoomSettings() {
    if (!settingsKey.value) {
      return;
    }

    const _settings = localStorage.getItem(settingsKey.value);

    settings.value = tryParseJson(_settings, DEFAULT_ROOM_SETTINGS);
  }

  async function getAccessToken(): Promise<string | undefined> {
    await refreshIfNeeded();
    return auth.value?.access_token;
  }

  async function getAuthHeaders() {
    let headers: RawAxiosRequestHeaders = {
      "X-User": await mainStore.getUser(),
    };

    if (isAuthorized.value) {
      const accessToken = await getAccessToken();

      headers = {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    return headers;
  }

  async function refresh() {
    const data = {
      refresh_token: auth.value?.refresh_token,
    };

    try {
      const response = await axios.post<LoginResponse>(`/api/auth/refresh`, data);
      auth.value = response.data;
    } catch (e) {
      // If refresh request returns unauthorized, clear auth info.
      if (e instanceof AxiosError && e?.response?.status === 401) {
        auth.value = undefined;
      }
    }
  }

  async function refreshIfNeeded() {
    if (!auth.value) {
      return;
    }

    const now = Date.now() / 1000;

    // If token is within 1 minute of expiring, refresh
    if (now > auth.value.exp - 60) {
      await refresh();
    }
  }

  async function verifyLogin() {
    if (!auth.value?.access_token || !exists.value) {
      return false;
    }

    try {
      await axios.post(`/api/r/i/${id.value}/loggedin`, null, {
        headers: await getAuthHeaders(),
      });
    } catch {
      auth.value = undefined;
    }

    return isAuthorized;
  }

  async function login(password: string): Promise<boolean> {
    const data = {
      level: "room",
      room_id: id.value,
      password: password,
    };

    try {
      const response = await axios.post<LoginResponse>(`/api/auth/login`, data);
      auth.value = response.data;

      return true;
    } catch {
      auth.value = undefined;
      return false;
    }
  }

  async function deletePost(postId: number) {
    await axios.delete(`/api/chat/${id.value}/post/${postId}`, {
      headers: await getAuthHeaders(),
    });
  }

  async function setContent(url: string, options?: { duration?: number; isLivestream?: boolean }) {
    if (!isAuthorized.value) {
      console.log("User not authorized to perform action.");
      return;
    }

    const data = {
      url,
      duration: options?.duration,
      is_livestream: options?.isLivestream,
    };

    return await axios.post(`/api/r/i/${id.value}/setcontent`, data, {
      headers: await getAuthHeaders(),
    });
  }

  function createWebsocketListener() {
    return ws.create_listener();
  }

  async function broadcastPlaybackState(ps: PlaybackState) {
    if (!isMaster.value) {
      return;
    }

    ps.time += ws.latency * ps.rate;

    ws.send("master-playbackstate", ps);
  }

  async function setMaster(v: boolean) {
    if (isMaster.value === v) {
      return;
    }

    isMaster.value = v;

    if (isMaster.value) {
      ws.send("set-master");
    } else {
      ws.send("not-master");
    }
  }

  async function deleteEmote(emoteId: number) {
    await axios.delete(`/api/chat/${id.value}/emote/${emoteId}`, {
      headers: await getAuthHeaders(),
    });
  }

  async function submitEmote(emote: NewEmote, onUploadProgress?: (progressEvent: AxiosProgressEvent) => void) {
    const formData = new FormData();
    formData.append("name", emote.name);
    formData.append("image", emote.image!, emote.image!.name);

    await axios.post(`/api/chat/${id.value}/emote`, formData, {
      headers: await getAuthHeaders(),
      onUploadProgress,
    });
  }

  async function initialize() {
    const ws_protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws_url = `${ws_protocol}://${window.location.host}/aria-ws`;

    ws = new AriaWebSocket(
      ws_url,
      async () => {
        isConnected.value = true;

        ws.send("join", { room: name.value, user: await mainStore.getUser() });
      },
      async () => {
        isConnected.value = false;
        isMaster.value = false;
      },
    );

    async function authorizeWebsocket() {
      ws.send("auth", await getAccessToken());
    }

    const ws_listener = ws.create_listener();

    ws_listener.on("joined", async () => {
      const last_emote_id = Object.values(emotes.value)
        .map((e) => e.id)
        .reduce((p, c) => (c > p ? c : p), 0);

      ws.send("get-emotes", { since: last_emote_id });

      if (isAuthorized.value) {
        await authorizeWebsocket();
      } else {
        const unwatch = watch(isAuthorized, async () => {
          await authorizeWebsocket();
          unwatch();
        });
      }
    });

    ws_listener.on("emotes", async (_emotes: Emote[]) => {
      for (const e of _emotes) {
        emotes.value[e.name] = e;
      }
    });

    ws_listener.on("emote", async (emote: Emote) => {
      emotes.value[emote.name] = emote;
    });

    ws_listener.on("delete-emote", async (name: string) => {
      delete emotes.value[name];
    });

    ws_listener.on("content", async (_content: Content) => {
      content.value = _content;
    });

    ws_listener.on("not-master", () => {
      isMaster.value = false;
    });

    ws_listener.on("playbackstate", async (ps: PlaybackState) => {
      serverPlaybackStateTimestamp.value = getTimestamp();

      ps.time += ws.latency * ps.rate;
      serverPlaybackState.value = ps;
    });
  }

  const initializePromise = initialize();

  async function isInitialized() {
    await initializePromise;
  }

  return {
    isLoaded,
    loadError,
    name,
    id,
    exists,
    settings,
    isAuthorized,
    content,
    emotes,
    serverPlaybackState,
    serverPlaybackStateTimestamp,
    isConnected,
    isMaster,
    ws,
    claimRoom,
    loadRoom,
    createWebsocketListener,
    login,
    getAuthHeaders,
    deletePost,
    deleteEmote,
    submitEmote,
    setContent,
    broadcastPlaybackState,
    setMaster,
    isInitialized,
  };
});
