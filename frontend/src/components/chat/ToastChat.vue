<script setup lang="ts">
import ChatPost from "./ChatPost.vue";

import { useMainStore } from "@/stores/main";
import { useChatStore } from "@/stores/chat";

const mainStore = useMainStore();
const chatStore = useChatStore();
</script>

<template>
  <div class="toast-chat chat" :class="`theme-${mainStore.settings.theme}`">
    <div class="post-container">
      <ChatPost :post="post" v-for="post of chatStore.recentPosts" :key="post.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/toast-chat.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
