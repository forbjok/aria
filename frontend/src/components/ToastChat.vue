<script setup lang="ts">
import { inject, reactive } from "vue";

import ChatPost from "./ChatPost.vue";

import type { Post } from "@/models";
import type { RoomSettingsService } from "@/services/room-settings";

const settings: RoomSettingsService | undefined = inject("settings");

const posts = reactive<Post[]>([]);

const post = (_post: Post) => {
  posts.push(_post);

  setTimeout(() => {
    posts.shift();
  }, 4000);
};

defineExpose({
  post,
});
</script>

<template>
  <div class="toast-chat chat" :class="`theme-${settings?.theme.value}`">
    <ul class="post-container">
      <ChatPost :post="post" v-for="post of posts" :key="post.id"></ChatPost>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/toast-chat.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
