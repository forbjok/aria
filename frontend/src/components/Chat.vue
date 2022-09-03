<script setup lang="ts">
import { inject, onMounted, reactive, ref, toRefs } from "vue";
import io from "socket.io-client";
import axios from "axios";
import $ from "jquery";
import filesize from "filesize";
import moment from "moment";
import * as xssFilters from "xss-filters";

import { VERSION } from "@/version";
import type { LocalRoomSettingsService } from "@/services/localroomsettingsservice";

import "@/styles/chat.scss";
import "@/styles/chat-dark.scss";
import "@/styles/chat-yotsubab.scss";

const props = defineProps<{
  room: string;
}>();

const { room } = toRefs(props);

const maxImageSize = 2097152;

const versionText = `v${VERSION}`;

interface Image {
  url: string;
  thumbUrl: string;
  originalFilename: string;
}

interface Post {
  id: number;
  name: string;
  comment: string;
  image?: Image;
  posted: string;
  showFullImage: boolean;
}

interface NewPost {
  name: string;
  comment: string;
  image?: File;
}

const settings: LocalRoomSettingsService | undefined = inject("settings");

const triggerPostLayout = ref(false);
const postForm = ref<HTMLFormElement | null>(null);
const postContainer = ref<HTMLFormElement | null>(null);
const chatControls = ref<HTMLFormElement | null>(null);

const posts = reactive<Post[]>([]);

const themes = [
  { name: "dark", description: "Dark" },
  { name: "yotsubab", description: "Yotsuba B" },
];

const theme = ref(settings?.get("chat_theme", null) || "dark");
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

// The purpose of this function is to work around a bug in Chrome that
// causes it to not recalculate the layout of posts when the posting
// form is resized. In order to force this, we set "triggerPostLayout"
// to true briefly before resetting it to false. Because it is bound to
// an empty div at the end of the post-container with if.bind, it will
// trigger a layout update.
const _triggerPostLayout = () => {
  triggerPostLayout.value = true;

  setInterval(() => {
    triggerPostLayout.value = false;
  }, 100);
};

const resizeChatControls = () => {
  if (!chatControls.value) return;
  if (!postContainer.value) return;

  const height = $(chatControls.value).height() || 0;

  $(postContainer.value).css("bottom", height);
  _triggerPostLayout();
};

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
  settings?.set("chat_theme", theme);
};

const toggleCompactPostForm = () => {
  useCompactPostForm.value = !useCompactPostForm.value;

  setTimeout(() => {
    resizeChatControls();
  }, 1);
};

const toggleImage = (post: Post): void => {
  post.showFullImage = !post.showFullImage;
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
    $(event.target as HTMLInputElement).val("");
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

const formatTime = (value: string): string => {
  const now = moment();
  const time = moment(value);

  if (now.isSame(time, "day")) {
    // If time is today, omit the date
    return time.format("HH:mm:ss");
  } else if (now.isSame(time, "year")) {
    // If time is not today, but this year, include date without year
    return time.format("MMM Do, HH:mm:ss");
  }

  // If time is not this year, include full date with year
  return time.format("MMM Do YYYY, HH:mm:ss");
};

const formatPost = (value: string): string => {
  if (!value) {
    return value;
  }

  return xssFilters
    .inHTMLData(value)
    .replace(/((^|\n)>.*)/g, '<span class="quote">$1</span>') // Color quotes
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>') // Clickable links
    .replace(/\n/g, "<br>"); // Convert newlines to HTML line breaks
};

onMounted(() => {
  resizeChatControls();

  const url = window.location.origin + "/chat";

  // We have to use this window.location.origin + "/namespace" workaround
  // because of a bug in socket.io causing the port number to be omitted,
  // that's apparently been there for ages and yet still hasn't been fixed
  // in a release. Get your shit together, Socket.io people.
  const socket = io(url, { path: "/aria-ws", autoConnect: false });

  socket.on("connect", () => {
    socket.emit("join", room.value);
  });

  socket.on("post", (post) => {
    posts.push(post);
  });

  socket.connect();
});
</script>

<template>
  <div class="chat" :class="[`theme-${theme}`]">
    <div ref="postContainer" class="chat-postcontainer">
      <ul>
        <li class="post" v-for="p of posts" :key="p.id">
          <div class="post-header">
            <span class="time">{{ formatTime(p.posted) }}</span>
            <span class="name">{{ p.name }}</span>
          </div>
          <div class="post-body">
            <div v-if="p.image" class="post-image" :class="p.showFullImage ? 'expanded' : ''">
              <a :href="p.image.url" @click.prevent="toggleImage(p)" target="_blank">
                <img class="thumbnail" :src="p.image.thumbUrl" :title="p.image.originalFilename" />
                <img v-if="p.showFullImage" class="expanded-image" :src="p.image.url" />
              </a>
              <div class="filename">{{ p.image.originalFilename }}</div>
            </div>
            <div class="comment" v-html="formatPost(p.comment)"></div>
          </div>
        </li>
      </ul>
      <!-- This is part of a workaround for a bug in Chrome causing it to not correctly recalculate the post container layout when the posting form is resized -->
      <div v-if="triggerPostLayout" class="after-posts"></div>
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

<style scoped lang="scss"></style>
