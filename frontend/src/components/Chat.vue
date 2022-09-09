<script setup lang="ts">
import { inject, onMounted, onUnmounted, reactive, ref, toRefs } from "vue";
import axios from "axios";
import filesize from "filesize";

import ChatPost from "./ChatPost.vue";

import { VERSION } from "@/version";
import type { LocalRoomSettingsService } from "@/services/localroomsettingsservice";

import type { Post } from "@/models";
import type { AriaWebSocket, AriaWsListener } from "@/services/websocket";

const props = defineProps<{
  room: string;
}>();

const emit = defineEmits<{
  (e: "post", post: Post): void;
  (e: "themechange", theme: string): void;
}>();

const { room } = toRefs(props);

const maxImageSize = 2097152;

const versionText = `v${VERSION}`;

interface NewPost {
  name: string;
  comment: string;
  image?: File;
}

const settings: LocalRoomSettingsService | undefined = inject("settings");
const ws: AriaWebSocket | undefined = inject("ws");

const postContainer = ref<HTMLDivElement | null>(null);
const postForm = ref<HTMLFormElement | null>(null);

const posts = reactive<Post[]>([]);

const themes = [
  { name: "dark", description: "Dark" },
  { name: "yotsubab", description: "Yotsuba B" },
];

const theme = ref<string>(settings?.get("chat_theme", null) || "dark");
emit("themechange", theme.value);

let posting = false;
const postingProgress = ref("");
const postingCooldown = ref(0);
let submitOnCooldown = false;

const createEmptyPost = (): NewPost => {
  return {
    name: settings?.get("chat_name", null) || "",
    comment: "",
  };
};

const post = ref(createEmptyPost());
const useCompactPostForm = ref(false);

const imageSelected = (event: Event) => {
  const p = post.value;

  const input = event.target as HTMLInputElement;
  if (!input || !input.files) return;

  p.image = input.files[0];

  if (p.image && p.image.size > maxImageSize) {
    alert(`The selected file is bigger than the maximum allowed size of ${filesize(maxImageSize)}`);
  }
};

const themeSelected = () => {
  settings?.set("chat_theme", theme.value);
  emit("themechange", theme.value);
};

const toggleCompactPostForm = () => {
  useCompactPostForm.value = !useCompactPostForm.value;
};

const clearPost = () => {
  postForm.value?.reset();
  post.value = createEmptyPost();
};

const canSubmitPost = (): boolean => {
  // Prevent duplicate submits
  if (posting) {
    return false;
  }

  const image = post.value.image;

  // Disallow posts with neither comment nor image
  if (!post.value.comment && !image) {
    return false;
  }

  // Disallow posting images bigger than the max image size
  if (image && image.size > maxImageSize) {
    return false;
  }

  return true;
};

const postUrl = () => {
  return `/api/chat/${room.value}/post`;
};

const activatePostingCooldown = () => {
  postingCooldown.value = 5;
  const cooldownInterval = setInterval(() => {
    postingCooldown.value -= 1;

    if (postingCooldown.value <= 0) {
      clearInterval(cooldownInterval);
      postingProgress.value = "";

      if (submitOnCooldown) {
        submitOnCooldown = false;
        submitPost();
      }
    }
  }, 1000);
};

const submitPost = async () => {
  if (!canSubmitPost()) {
    return;
  }

  if (postingCooldown.value > 0) {
    submitOnCooldown = !submitOnCooldown;
    return;
  }

  const image = post.value.image;

  const formData = new FormData();
  formData.append("name", post.value.name);
  formData.append("comment", post.value.comment);

  if (image) {
    formData.append("image", image, image.name);
  }

  // Disable post controls while posting
  posting = true;

  // Save name in cookie
  settings?.set("chat_name", post.value.name);

  try {
    await axios.post(postUrl(), formData, {
      onUploadProgress: (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          postingProgress.value = `${percentComplete}%`;
        } else {
          postingProgress.value = "Posting...";
        }
      },
    });

    postingProgress.value = "Posted.";
    clearPost();

    // Activate posting cooldown
    activatePostingCooldown();
  } catch (err) {
    // Display the error response from the server
    postingProgress.value = err as string;

    // Activate posting cooldown
    activatePostingCooldown();
  } finally {
    posting = false;
  }
};

const submitOnEnterKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    submitPost();
    event.preventDefault();
    return;
  }
};

const clearFileOnShiftClick = (event: MouseEvent) => {
  if (event.shiftKey) {
    (event.target as HTMLInputElement).value = "";
    delete post.value.image;

    event.preventDefault();
    return;
  }
};

const postingCooldownText = () => {
  if (postingCooldown.value > 0) {
    if (submitOnCooldown) {
      return `Auto (${postingCooldown.value})`;
    }

    return `${postingCooldown.value}`;
  }
};

let ws_listener: AriaWsListener | undefined;

onMounted(() => {
  ws_listener = ws?.create_listener();
  if (ws_listener) {
    ws_listener.on("post", (post: Post) => {
      posts.push(post);
      emit("post", post);
    });

    ws_listener.on("oldposts", (_posts: Post[]) => {
      let newPosts: Post[];
      if (posts.length > 0) {
        const lastPost = posts[posts.length - 1];
        newPosts = _posts.filter((p) => p.id > lastPost.id);
      } else {
        newPosts = _posts;
      }

      posts.push(...newPosts);

      setTimeout(() => {
        const _postContainer = postContainer.value;
        if (!_postContainer) {
          return;
        }

        // Scroll to bottom of post container
        _postContainer.scrollTo(0, _postContainer.scrollHeight);
      }, 1);
    });
  }
});

onUnmounted(() => {
  ws_listener?.dispose();
});
</script>

<template>
  <div class="chat" :class="[`theme-${theme}`]">
    <div ref="postContainer" class="post-container">
      <ul>
        <ChatPost :post="post" v-for="post of posts" :key="post.id"></ChatPost>
        <li class="bottom-spacer"></li>
      </ul>
    </div>

    <div ref="chatControls" class="chatcontrols">
      <form ref="postForm" @submit.prevent="submitPost()">
        <div v-if="!useCompactPostForm">
          <table class="chatcontrols-table">
            <tr>
              <td>Name</td>
              <td>
                <input name="name" type="text" v-model="post.name" placeholder="Anonymous" :readonly="posting" />
              </td>
            </tr>
            <tr>
              <td>Comment</td>
              <td>
                <textarea
                  name="comment"
                  v-model="post.comment"
                  maxlength="600"
                  class="comment-field"
                  wrap="soft"
                  :readonly="posting"
                  @keydown="submitOnEnterKeydown($event)"
                  autofocus
                ></textarea>
              </td>
            </tr>
            <tr>
              <td>Image</td>
              <td>
                <input
                  name="image"
                  type="file"
                  accept="image/*"
                  @change="imageSelected($event)"
                  :disabled="posting"
                  @keydown="submitOnEnterKeydown($event)"
                  @click="clearFileOnShiftClick($event)"
                />
              </td>
            </tr>
            <tr>
              <td></td>
              <td>
                <button id="postbutton" type="submit" :disabled="!canSubmitPost">
                  {{ postingCooldownText() || "Post" }}
                </button>
                <span class="progress">{{ postingProgress }}</span>
              </td>
            </tr>
          </table>
          <div class="version-text">{{ versionText }}</div>
        </div>
        <div v-if="useCompactPostForm" class="chatcontrols-table">
          <textarea
            name="comment"
            v-model="post.comment"
            maxlength="600"
            class="comment-field"
            wrap="soft"
            :readonly="posting"
            @keydown="submitOnEnterKeydown($event)"
            autofocus
          ></textarea>
          <button id="postbutton" type="submit" :disabled="!canSubmitPost">
            {{ postingCooldownText() || postingProgress || "Post" }}
          </button>
          <input
            name="image"
            type="file"
            accept="image/*"
            @change="imageSelected($event)"
            :disabled="posting"
            @keydown="submitOnEnterKeydown($event)"
            @click="clearFileOnShiftClick($event)"
          />
        </div>
      </form>
      <div class="options">
        <select v-if="!useCompactPostForm" v-model="theme" @change="themeSelected()">
          <option v-for="theme of themes" :key="theme.name" :value="theme.name">{{ theme.description }}</option>
        </select>
        <button
          type="button"
          class="toggle-compact-button"
          title="Toggle compact post form"
          @click="toggleCompactPostForm()"
        >
          <span class="fa" :class="useCompactPostForm ? 'fa-caret-up' : 'fa-caret-down'"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/chat.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
