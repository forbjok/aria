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

interface LinkToken extends Token {
  t: "l";
}

const commentParser = P.createLanguage<{
  comment: Token[];
  emote: EmoteToken;
  html: HtmlToken;
  whitespace: HtmlToken;
  link: LinkToken;
}>({
  comment: (r) => P.alt(r.emote, r.link, r.html, r.whitespace).many(),
  emote: () => P.regexp(/!([\w\d]+)/).map((text) => ({ t: "e", text })),
  html: () => P.regexp(/[^\s]+/).map((text) => ({ t: "h", text })),
  whitespace: () => P.regexp(/\s+/).map((text) => ({ t: "h", text })),
  link: () => P.regexp(/(https?:\/\/[^\s]+)/).map((text) => ({ t: "l", text })),
});

const Comment = (p: { text: string }) => {
  const nodes: VNodeArrayChildren = [];

  let html: string[] = [];

  const addHtml = (_html: string) => {
    html.push(_html);
  };

  const flushHtml = () => {
    if (html.length > 0) {
      nodes.push(h("span", { innerHTML: html.join(" ") }));
      html = [];
    }
  };

  const tokens = commentParser.comment.tryParse(p.text);

  for (const t of tokens) {
    if (t.t === "e") {
      const name = t.text.substring(1);
      const emote = room?.emotes[name];
      if (!emote) {
        addHtml(t.text);
        continue;
      }

      flushHtml();
      nodes.push(h(Emote, { emote }));
    } else if (t.t === "h") {
      addHtml(t.text);
    } else if (t.t === "l") {
      flushHtml();
      nodes.push(h("a", { href: t.text }, t.text));
    }
  }

  flushHtml();

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
