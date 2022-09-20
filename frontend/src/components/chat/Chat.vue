<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from "vue";
import axios, { type AxiosRequestHeaders } from "axios";
import filesize from "filesize";

import ChatPost from "./ChatPost.vue";
import EmoteSelector from "./EmoteSelector.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

import type { Post } from "@/models";
import type { RoomService } from "@/services/room";
import type { RoomSettingsService } from "@/services/room-settings";
import type { AriaWebSocket, AriaWsListener } from "@/services/websocket";
import type { RoomAuthService } from "@/services/room-auth";
import type { UserService } from "@/services/user";

const emit = defineEmits<{
  (e: "post", post: Post): void;
}>();

const auth = inject<RoomAuthService>("auth");
const room = inject<RoomService>("room");

const maxPosts = 200;
const maxImageSize = 2097152;

interface NewPost {
  name: string;
  comment: string;
  image?: File;
}

const settings = inject<RoomSettingsService>("settings");
const user = inject<UserService>("user");
const ws = inject<AriaWebSocket>("ws");

const postContainer = ref<HTMLDivElement>();
const postForm = ref<HTMLFormElement>();
const commentField = ref<HTMLTextAreaElement>();
const confirmDeleteDialog = ref<typeof ConfirmDialog>();

const posts = ref<Post[]>([]);
const actionTargetPost = ref<Post>();

const themes = [
  { name: "dark", description: "Dark" },
  { name: "yotsubab", description: "Yotsuba B" },
];

let posting = false;
const postingProgress = ref("");
const postingCooldown = ref(0);
let submitOnCooldown = false;

const createEmptyPost = (): NewPost => {
  return {
    name: settings?.chatName.value || "",
    comment: "",
  };
};

const post = ref(createEmptyPost());
const highlightedPost = ref(-1);
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

const theme = ref(settings?.theme || "");
const themeSelected = () => {
  if (settings) {
    settings.theme.value = theme.value;
    settings.save();
  }
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

  const _post = post.value;

  const image = _post.image;

  const formData = new FormData();

  if (_post.name) {
    formData.append("name", _post.name);
  }

  if (_post.comment) {
    formData.append("comment", _post.comment);
  }

  const password = user?.password;
  if (password) {
    formData.append("password", password);
  }

  if (image) {
    formData.append("image", image, image.name);
  }

  // Disable post controls while posting
  posting = true;

  // Save chat name
  if (settings) {
    settings.chatName.value = post.value.name;
    settings.save();
  }

  try {
    await axios.post(`/api/chat/${room?.id}/post`, formData, {
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
    scrollToBottom();

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

const quotePost = (id: number) => {
  post.value.comment += `>>${id}\n`;
  commentField.value?.focus();
};

const scrollToBottom = () => {
  const _postContainer = postContainer.value;
  if (!_postContainer) {
    return;
  }

  // Scroll to bottom of post container
  _postContainer.scrollTo(0, _postContainer.scrollHeight);
};

const showEmoteSelector = ref(false);
const openEmoteSelector = () => {
  showEmoteSelector.value = !showEmoteSelector.value;
};

const selectEmote = (name: string) => {
  post.value.comment += `!${name}`;
  showEmoteSelector.value = false;
  commentField.value?.focus();
};

const highlightPost = (id: number) => {
  highlightedPost.value = id;
};

const deletePost = async (post?: Post) => {
  if (!post) {
    return;
  }

  let headers: AxiosRequestHeaders = {
    "X-Password": user?.password || "",
  };

  if (auth?.isAuthorized.value) {
    headers = {
      ...headers,
      Authorization: `Bearer ${auth?.getToken()}`,
    };
  }

  await axios.delete(`/api/chat/${room?.id}/post/${post.id}`, {
    headers,
  });
};

const confirmDeletePost = async (post: Post) => {
  actionTargetPost.value = post;
  confirmDeleteDialog.value?.show();
};

let ws_listener: AriaWsListener | undefined;

onMounted(() => {
  ws_listener = ws?.create_listener();
  if (ws_listener) {
    ws_listener.on("post", (post: Post) => {
      const _posts = posts.value;
      if (_posts.length >= maxPosts) {
        _posts.splice(0, 2);
      }

      _posts.push(post);
      emit("post", post);
    });

    ws_listener.on("delete-post", (postId: number) => {
      const _posts = posts.value;
      const post = _posts.find((p) => p.id === postId);
      if (!post) {
        return;
      }

      post.isDeleted = true;
    });

    ws_listener.on("oldposts", (__posts: Post[]) => {
      const _posts = posts.value;
      let newPosts: Post[];
      if (_posts.length > 0) {
        const lastPost = _posts[_posts.length - 1];
        newPosts = __posts.filter((p) => p.id > lastPost.id);
      } else {
        newPosts = __posts;
      }

      _posts.push(...newPosts);

      setTimeout(() => {
        scrollToBottom();
      }, 1);
    });
  }
});

onUnmounted(() => {
  ws_listener?.dispose();
});
</script>

<template>
  <div class="chat" :class="`theme-${settings?.theme.value}`">
    <div class="chat-posts">
      <div ref="postContainer" class="post-container">
        <ChatPost
          :post="post"
          v-for="post of posts"
          :key="post.id"
          :highlight="highlightedPost === post.id"
          :actions="true"
          @quotepost="quotePost"
          @clickquotelink="highlightPost"
          @delete="confirmDeletePost(post)"
        />
      </div>
    </div>
    <div ref="chatControls" class="chat-controls">
      <form ref="postForm" @submit.prevent="submitPost">
        <div v-if="!useCompactPostForm">
          <table class="chat-controls-table">
            <tr>
              <td>
                <input name="name" type="text" v-model="post.name" placeholder="Anonymous" :readonly="posting" />
              </td>
            </tr>
            <tr>
              <td>
                <textarea
                  ref="commentField"
                  name="comment"
                  v-model="post.comment"
                  placeholder="Comment"
                  maxlength="600"
                  class="comment-field"
                  wrap="soft"
                  :readonly="posting"
                  @keydown="submitOnEnterKeydown"
                  autofocus
                ></textarea>
              </td>
            </tr>
            <tr>
              <td>
                <input
                  name="image"
                  type="file"
                  accept="image/*"
                  @change="imageSelected"
                  :disabled="posting"
                  @keydown="submitOnEnterKeydown"
                  @click="clearFileOnShiftClick"
                />
              </td>
            </tr>
            <tr>
              <td>
                <button class="post-button" type="submit" :disabled="!canSubmitPost()">
                  {{ postingCooldownText() || "Post" }}
                </button>
                <span class="progress">{{ postingProgress }}</span>
              </td>
            </tr>
          </table>
        </div>
        <div v-if="useCompactPostForm" class="chat-controls-table">
          <textarea
            ref="commentField"
            name="comment"
            v-model="post.comment"
            placeholder="Comment"
            maxlength="600"
            class="comment-field"
            wrap="soft"
            :readonly="posting"
            @keydown="submitOnEnterKeydown($event)"
            autofocus
          ></textarea>
          <button class="post-button" type="submit" :disabled="!canSubmitPost">
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
        <button class="emote-button" title="Emotes" @click="openEmoteSelector">
          <i class="fa-regular fa-face-smile"></i>
        </button>
        <select v-if="!useCompactPostForm" class="theme-selector" v-model="theme" @change="themeSelected">
          <option v-for="theme of themes" :key="theme.name" :value="theme.name">{{ theme.description }}</option>
        </select>
        <button
          type="button"
          class="toggle-compact-button"
          title="Toggle compact post form"
          @click="toggleCompactPostForm"
        >
          <span class="fa" :class="useCompactPostForm ? 'fa-caret-up' : 'fa-caret-down'"></span>
        </button>
      </div>
    </div>

    <!-- Dialogs -->
    <div v-if="showEmoteSelector" class="overlay" @click="showEmoteSelector = false">
      <EmoteSelector @selectemote="selectEmote" />
    </div>
    <Teleport to="#overlay">
      <ConfirmDialog ref="confirmDeleteDialog" title="Confirm delete" @confirm="deletePost(actionTargetPost)">
        <template v-slot:confirm><i class="fa-solid fa-trash"></i> Delete</template>
        <div v-if="!!actionTargetPost" class="confirm-delete-dialog">
          <span>Are you sure you want to delete this post?</span>
          <div class="post-preview" :class="`theme-${settings?.theme.value}`">
            <div class="post-container">
              <ChatPost :post="actionTargetPost" />
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/chat.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
