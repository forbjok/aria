<script setup lang="ts">
import { reactive } from "vue";

import ChatPost from "./ChatPost.vue";

import { useMainStore } from "@/stores/main";

import type { Post } from "@/models";

const mainStore = useMainStore();

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
  <div class="toast-chat chat" :class="`theme-${mainStore.settings.theme}`">
    <div class="post-container">
      <ChatPost :post="post" v-for="post of posts" :key="post.id"></ChatPost>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/toast-chat.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
