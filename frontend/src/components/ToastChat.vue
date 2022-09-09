<script setup lang="ts">
import { reactive, toRefs } from "vue";

import ChatPost from "./ChatPost.vue";

import type { Post } from "@/models";

const props = defineProps<{
  theme: string;
}>();

const { theme } = toRefs(props);

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
  <div class="toast-chat chat" :class="[`theme-${theme}`]">
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
