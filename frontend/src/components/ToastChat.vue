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
    <div class="post-container">
      <ul>
        <ChatPost :post="post" v-for="post of posts" :key="post.id"></ChatPost>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import "@/styles/toast-chat.scss";
@import "@/styles/chat-dark.scss";
@import "@/styles/chat-yotsubab.scss";
</style>
