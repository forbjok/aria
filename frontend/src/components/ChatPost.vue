<script setup lang="ts">
import { h, inject, toRefs, type VNodeArrayChildren } from "vue";

import moment from "moment";

import Emote from "./Emote.vue";

import type { Emote as EmoteModel, Post, RoomInfo } from "@/models";

const props = defineProps<{
  post: Post;
}>();

const emit = defineEmits<{
  (e: "quotepost", id: number): void;
}>();

const { post } = toRefs(props);

const room: RoomInfo | undefined = inject("room");

const toggleImage = (_post: Post): void => {
  _post.showFullImage = !_post.showFullImage;
};

const quotePost = (id: number) => {
  emit("quotepost", id);
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

const emoteRegex = new RegExp("!([\\w\\d]+)");
const Comment = (p: { text: string }) => {
  const nodes: VNodeArrayChildren = [];

  let remaining = p.text;

  const mkHtml = (innerHTML: string) => {
    nodes.push(h("span", { innerHTML }));
  };

  const mkEmote = (emote: EmoteModel) => {
    nodes.push(h(Emote, { emote }));
  };

  // Traverse comment string and construct VNodes
  while (remaining.length > 0) {
    const m = emoteRegex.exec(remaining);
    if (!m) {
      mkHtml(remaining);
      remaining = "";
      break;
    }

    const preceding = remaining.substring(0, m.index);
    mkHtml(preceding);

    remaining = remaining.substring(preceding.length + m[0].length);

    const name = m[1];
    const emote = room?.emotes[name];
    if (!emote) {
      mkHtml(m[0]);
      continue;
    }

    mkEmote(emote);
  }

  return h("div", { class: "comment" }, nodes);
};
</script>

<template>
  <li :id="`p${post.id}`" class="post">
    <div class="post-header">
      <span class="time">{{ formatTime(post.posted) }}</span>
      <span class="name">{{ post.name || "Anonymous" }}</span>
      <span class="id"
        >No. <a @click="quotePost(post.id)">{{ post.id }}</a></span
      >
    </div>
    <div class="post-body">
      <div v-if="post.image" class="post-image" :class="post.showFullImage ? 'expanded' : ''">
        <a :href="post.image.url" @click.prevent="toggleImage(post)" target="_blank">
          <img class="thumbnail" :src="post.image.tn_url" :title="post.image.filename" />
          <img v-if="post.showFullImage" class="expanded-image" :src="post.image.url" />
        </a>
        <div class="filename">{{ post.image.filename }}</div>
      </div>
      <Comment :text="post.comment" />
    </div>
  </li>
</template>

<style scoped lang="scss">
@use "@/styles/chat-post.scss" as *;
@use "@/styles/chat-dark.scss" as *;
@use "@/styles/chat-yotsubab.scss" as *;
</style>
