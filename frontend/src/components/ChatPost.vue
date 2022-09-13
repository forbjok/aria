<script setup lang="ts">
import { toRefs } from "vue";

import PostComment from "./PostComment.vue";

import moment from "moment";

import type { Post } from "@/models";

const props = defineProps<{
  post: Post;
  highlight: boolean;
}>();

const emit = defineEmits<{
  (e: "quotepost", id: number): void;
  (e: "clickquotelink", id: number): void;
}>();

const { post, highlight } = toRefs(props);

const toggleImage = (_post: Post): void => {
  _post.showFullImage = !_post.showFullImage;
};

const quotePost = (id: number) => {
  emit("quotepost", id);
};

const clickQuoteLink = (id: number) => {
  emit("clickquotelink", id);
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
</script>

<template>
  <div :id="`p${post.id}`" class="post" :class="highlight ? 'highlight' : ''">
    <div class="post-header">
      <span class="time">{{ formatTime(post.posted) }}</span>
      <span class="name">{{ post.name || "Anonymous" }}</span>
      <div class="id">
        <a @click="clickQuoteLink(post.id)">No.</a> <a @click="quotePost(post.id)">{{ post.id }}</a>
      </div>
    </div>
    <div class="post-body">
      <div v-if="post.image" class="post-image" :class="post.showFullImage ? 'expanded' : ''">
        <a :href="post.image.url" @click.prevent="toggleImage(post)" target="_blank">
          <img class="thumbnail" :src="post.image.tn_url" :title="post.image.filename" />
          <img v-if="post.showFullImage" class="expanded-image" :src="post.image.url" />
        </a>
        <div class="filename">{{ post.image.filename }}</div>
      </div>
      <PostComment :text="post.comment" @clickquotelink="clickQuoteLink" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/chat-post.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
