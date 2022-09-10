<script setup lang="ts">
import { h, inject, toRefs, type VNodeArrayChildren } from "vue";
import * as P from "parsimmon";

import moment from "moment";

import Emote from "./Emote.vue";

import type { Post, RoomInfo } from "@/models";

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

interface Token {
  t: string;
  text: string;
}

interface EmoteToken extends Token {
  t: "e";
}

interface HtmlToken extends Token {
  t: "h";
}

const commentParser = P.createLanguage<{
  comment: Token[];
  emote: EmoteToken;
  html: HtmlToken;
}>({
  comment: (r) => P.alt(r.html, r.emote).many(),
  emote: () => P.regexp(/!([\w\d]+)/).map((text) => ({ t: "e", text })),
  html: () => P.regexp(/[^!]+/).map((text) => ({ t: "h", text })),
});

const Comment = (p: { text: string }) => {
  const nodes: VNodeArrayChildren = [];

  const mkHtml = (innerHTML: string) => {
    nodes.push(h("span", { innerHTML }));
  };

  const tokens = commentParser.comment.tryParse(p.text);

  for (const token of tokens) {
    if (token.t === "e") {
      const e = token as EmoteToken;
      const name = e.text.substring(1);
      const emote = room?.emotes[name];
      if (!emote) {
        mkHtml(e.text);
        continue;
      }

      nodes.push(h(Emote, { emote }));
    } else if (token.t === "h") {
      const h = token as HtmlToken;
      mkHtml(h.text);
    }
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
