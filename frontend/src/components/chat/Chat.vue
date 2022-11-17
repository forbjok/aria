<script setup lang="ts">
import { computed, ref } from "vue";
import { filesize } from "filesize";

import ChatPost from "./ChatPost.vue";
import EmoteSelector from "./EmoteSelector.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

import type { Post } from "@/models";

import { useMainStore } from "@/stores/main";
import { useRoomStore } from "@/stores/room";
import { MAX_IMAGE_SIZE, useChatStore } from "@/stores/chat";

const mainStore = useMainStore();
const roomStore = useRoomStore();
const chatStore = useChatStore();

const postContainer = ref<HTMLDivElement>();
const postForm = ref<HTMLFormElement>();
const commentField = ref<HTMLTextAreaElement>();
const confirmDeleteDialog = ref<typeof ConfirmDialog>();

const postingProgress = computed(() =>
  chatStore.posting
    ? chatStore.postingProgress
      ? `${chatStore.postingProgress}%`
      : "Posting..."
    : chatStore.postingError
    ? chatStore.postingError
    : undefined
);

const postingCooldownText = computed(() => {
  if (chatStore.postingCooldown > 0) {
    if (chatStore.submitOnCooldown) {
      return `Auto (${chatStore.postingCooldown})`;
    }

    return `${chatStore.postingCooldown}`;
  }

  return "";
});

const actionTargetPost = ref<Post>();

const themes = [
  { name: "dark", description: "Dark" },
  { name: "yotsubab", description: "Yotsuba B" },
];

const highlightedPost = ref(-1);
const useCompactPostForm = ref(false);

const imageSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input || !input.files) return;

  const image = input.files[0];

  if (image && image.size > MAX_IMAGE_SIZE) {
    alert(`The selected file is bigger than the maximum allowed size of ${filesize(MAX_IMAGE_SIZE)}`);
    return;
  }

  chatStore.newPost.image = image;
};

const toggleCompactPostForm = () => {
  useCompactPostForm.value = !useCompactPostForm.value;
};

const submitPost = async () => {
  if (!chatStore.canSubmitPost) {
    return;
  }

  const success = await chatStore.submitPost();
  if (success) {
    scrollToBottom();
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
    chatStore.newPost.image = undefined;

    event.preventDefault();
    return;
  }
};

const quotePost = (id: number) => {
  chatStore.newPost.comment += `>>${id}\n`;
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
  chatStore.newPost.comment += `!${name}`;
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

  await roomStore.deletePost(post.id);
};

const confirmDeletePost = async (post: Post) => {
  actionTargetPost.value = post;
  confirmDeleteDialog.value?.show();
};
</script>

<template>
  <div class="chat" :class="`theme-${mainStore.settings.theme}`">
    <div class="chat-posts">
      <div ref="postContainer" class="post-container">
        <ChatPost
          :post="post"
          v-for="post of chatStore.posts"
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
                <input
                  name="name"
                  type="text"
                  v-model="chatStore.newPost.name"
                  placeholder="Anonymous"
                  :readonly="chatStore.posting"
                />
                <div class="badges">
                  <button
                    v-if="roomStore.isAuthorized"
                    class="admin badge"
                    :class="{ off: !roomStore.settings.postBadges.room_admin }"
                    @click.prevent="
                      roomStore.settings.postBadges.room_admin = !roomStore.settings.postBadges.room_admin
                    "
                    title="Room Admin"
                  >
                    <i class="fa-solid fa-star"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <textarea
                  ref="commentField"
                  name="comment"
                  v-model="chatStore.newPost.comment"
                  placeholder="Comment"
                  maxlength="600"
                  class="comment-field"
                  wrap="soft"
                  :readonly="chatStore.posting"
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
                  :disabled="chatStore.posting"
                  @keydown="submitOnEnterKeydown"
                  @click="clearFileOnShiftClick"
                />
              </td>
            </tr>
            <tr>
              <td>
                <button class="post-button" type="submit" :disabled="!chatStore.canSubmitPost">
                  {{ postingCooldownText || "Post" }}
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
            v-model="chatStore.newPost.comment"
            placeholder="Comment"
            maxlength="600"
            class="comment-field"
            wrap="soft"
            :readonly="chatStore.posting"
            @keydown="submitOnEnterKeydown($event)"
            autofocus
          ></textarea>
          <button class="post-button" type="submit" :disabled="!chatStore.canSubmitPost">
            {{ postingCooldownText || postingProgress || "Post" }}
          </button>
          <input
            name="image"
            type="file"
            accept="image/*"
            @change="imageSelected($event)"
            :disabled="chatStore.posting"
            @keydown="submitOnEnterKeydown($event)"
            @click="clearFileOnShiftClick($event)"
          />
        </div>
      </form>
      <div class="options">
        <button class="emote-button" title="Emotes" @click="openEmoteSelector">
          <i class="fa-regular fa-face-smile"></i>
        </button>
        <select v-if="!useCompactPostForm" class="theme-selector" v-model="mainStore.settings.theme">
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
          <div class="post-preview" :class="`theme-${mainStore.settings.theme}`">
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
