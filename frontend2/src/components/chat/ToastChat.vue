<script setup lang="ts">
import ChatPost from "./ChatPost.vue";

import { useChatStore } from "@/stores/chat";

const chatStore = useChatStore();
</script>

<template>
  <div class="toast-chat chat">
    <div class="post-container">
      <ChatPost :post="post" v-for="post of chatStore.recentPosts" :key="post.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.toast-chat {
  // Override background from theme
  background: none !important;

  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.post-container {
  overflow: hidden;
  display: flex;
  flex-direction: column;

  list-style-type: none;
  padding: 0px;
  margin: 0px;

  .post {
    flex-shrink: 0;
  }
}
</style>
