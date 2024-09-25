<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { filesize } from "filesize";

import ChatPost from "./ChatPost.vue";
import EmoteSelector from "./EmoteSelector.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

import type { Post } from "@/models";

import { useMainStore } from "@/stores/main";
import { useRoomStore } from "@/stores/room";
import { useChatStore } from "@/stores/chat";

const mainStore = useMainStore();
const roomStore = useRoomStore();
const chatStore = useChatStore();

const postContainer = ref<HTMLDivElement>();
const postForm = ref<HTMLFormElement>();
const commentField = ref<HTMLTextAreaElement>();
const imageFileInput = ref<HTMLInputElement>();
const confirmDeleteDialog = ref<typeof ConfirmDialog>();

watch(chatStore.newPost, (v) => {
  if (!v.image) {
    imageFileInput.value!.value = "";
  }
});

const postingProgress = computed(() =>
  chatStore.posting
    ? chatStore.postingProgress
      ? `${chatStore.postingProgress}%`
      : "Posting..."
    : chatStore.postingError
      ? chatStore.postingError
      : undefined,
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

  const max_file_size = mainStore.sysConfig!.max_image_size;
  if (image && image.size > max_file_size) {
    alert(`The selected file is bigger than the maximum allowed size of ${filesize(max_file_size)}`);
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
  <div class="chat">
    <div class="chat-posts">
      <div ref="postContainer" class="post-container">
        <ChatPost :post="post" v-for="post of chatStore.posts" :key="post.id" :highlight="highlightedPost === post.id"
          :actions="true" @quotepost="quotePost" @clickquotelink="highlightPost" @delete="confirmDeletePost(post)" />
      </div>
    </div>
    <div ref="chatControls" class="chat-controls">
      <div v-show="!roomStore.isConnected" class="disconnected-indicator">NOT CONNECTED</div>
      <form ref="postForm" @submit.prevent="submitPost">
        <div v-if="!useCompactPostForm">
          <table class="chat-controls-table">
            <tbody>
              <tr>
                <td>
                  <input name="name" type="text" v-model="chatStore.newPost.name" placeholder="Anonymous"
                    :readonly="chatStore.posting" />
                  <div class="badges">
                    <button v-if="roomStore.isAuthorized" class="admin badge"
                      :class="{ off: !roomStore.settings.postBadges.room_admin }" @click.prevent="
                        roomStore.settings.postBadges.room_admin = !roomStore.settings.postBadges.room_admin
                        " title="Room Admin">
                      <i class="fa-solid fa-star"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <textarea ref="commentField" name="comment" v-model="chatStore.newPost.comment" placeholder="Comment"
                    maxlength="600" class="comment-field" wrap="soft" :readonly="chatStore.posting"
                    @keydown="submitOnEnterKeydown" autofocus></textarea>
                </td>
              </tr>
              <tr>
                <td>
                  <input ref="imageFileInput" name="image" type="file" accept="image/*" @change="imageSelected"
                    :disabled="chatStore.posting" @keydown="submitOnEnterKeydown" @click="clearFileOnShiftClick" />
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
            </tbody>
          </table>
        </div>
        <div v-if="useCompactPostForm" class="chat-controls-table">
          <textarea ref="commentField" name="comment" v-model="chatStore.newPost.comment" placeholder="Comment"
            maxlength="600" class="comment-field" wrap="soft" :readonly="chatStore.posting"
            @keydown="submitOnEnterKeydown($event)" autofocus></textarea>
          <button class="post-button" type="submit" :disabled="!chatStore.canSubmitPost">
            {{ postingCooldownText || postingProgress || "Post" }}
          </button>
          <input ref="imageFileInput" name="image" type="file" accept="image/*" @change="imageSelected($event)"
            :disabled="chatStore.posting" @keydown="submitOnEnterKeydown($event)"
            @click="clearFileOnShiftClick($event)" />
        </div>
      </form>
      <div class="options">
        <button class="emote-button" title="Emotes" @click="openEmoteSelector">
          <i class="fa-regular fa-face-smile"></i>
        </button>
        <select v-if="!useCompactPostForm" class="theme-selector" v-model="mainStore.settings.theme">
          <option v-for="theme of themes" :key="theme.name" :value="theme.name">{{ theme.description }}</option>
        </select>
        <button type="button" class="toggle-compact-button" title="Toggle compact post form"
          @click="toggleCompactPostForm">
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
          <div class="post-preview">
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
.chat {
  background-color: var(--color-chat-background);
  width: 100%;
  height: 100%;

  display: flex;
  flex-direction: column;

  .chat-posts {
    flex-grow: 1;

    display: flex;
    flex-direction: column-reverse;

    overflow-y: scroll;
    overflow-x: hidden;

    // Make scrollbar scroll to new posts automatically
    // when scrolled to the bottom.
    scroll-snap-type: y proximity;

    .post-container {
      display: flex;
      flex-direction: column;

      .post {
        flex-shrink: 0;
      }

      // Make scrollbar scroll to new posts automatically
      // when scrolled to the bottom.
      .post:last-child {
        scroll-margin-bottom: 2px;
        scroll-snap-align: end;
      }
    }
  }

  .chat-controls {
    flex-shrink: 0;

    background: var(--color-chat-controls-background);
    border-top: 1px solid var(--color-chat-controls-border-top);

    overflow: hidden;

    // Needed to prevent .options' absolute positioning
    // from placing it outside the parent element.
    position: relative;

    .badges {
      display: inline-flex;
      flex-direction: row;
      gap: 4px;

      padding: 0 4px;

      button {
        background: none;
        border: none;
        padding: 0;

        cursor: pointer !important;
      }

      .off {
        filter: brightness(0.4);
      }

      .admin {
        color: var(--color-admin-badge);
      }
    }
  }

  .chat-controls-table {
    width: 100%;
  }

  .progress {
    margin-left: 3px;
  }

  textarea.comment-field {
    resize: none;
    width: calc(100%);
  }

  .options {
    display: flex;
    flex-direction: row;

    position: absolute;
    right: 2px;
    bottom: 2px;
  }

  .emote-button {
    margin-right: 2px;
  }

  .theme-selector {
    margin-right: 2px;
  }

  .post-button {
    min-width: 65px;
  }

  .overlay {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
  }

  .emote-selector {
    position: absolute;
    left: 100px;
    bottom: 30px;

    max-width: 36vw;
    height: 33vh;

    // Portrait orientation
    @media screen and (max-aspect-ratio: 13/10) {
      left: 3vw;

      max-width: 94vw;
      height: 46vh;
    }
  }

  &.right-side-chat {
    .emote-selector {
      left: unset;
      right: 100px;
    }
  }
}

.confirm-delete-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .post-preview {
    width: 350px;

    max-width: 94vw;
    max-height: 80vh;

    overflow-y: auto;
  }
}

.disconnected-indicator {
  cursor: default;

  background-color: var(--color-disconnected-background);
  color: var(--color-disconnected-text);
  letter-spacing: 0.1rem;
  text-align: center;

  padding: 0.1rem;
}
</style>
