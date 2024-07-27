<script setup lang="ts">
import { ref, toRefs } from "vue";
import { format, isSameDay, isSameYear, parseJSON } from "date-fns";

import Image from "@/components/common/Image.vue";

import PostComment from "./PostComment.vue";

import { useRoomStore } from "@/stores/room";

import type { Post } from "@/models";

interface Props {
  post: Post;
  highlight?: boolean;
  actions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  highlight: false,
  actions: false,
});

const emit = defineEmits<{
  (e: "quotepost", id: number): void;
  (e: "clickquotelink", id: number): void;
  (e: "delete"): void;
}>();

const { post, highlight, actions } = toRefs(props);

const roomStore = useRoomStore();

const expandImage = ref(false);

const toggleExpandImage = () => {
  expandImage.value = !expandImage.value;
};

const quotePost = (id: number) => {
  emit("quotepost", id);
};

const clickQuoteLink = (id: number) => {
  emit("clickquotelink", id);
};

const deletePost = () => {
  emit("delete");
};

const formatTime = (value: string): string => {
  const now = new Date();
  const time = parseJSON(value);

  if (isSameDay(now, time)) {
    // If time is today, omit the date
    return format(time, "HH:mm:ss");
  } else if (isSameYear(now, time)) {
    // If time is not today, but this year, include date without year
    return format(time, "MMM do, HH:mm:ss");
  }

  // If time is not this year, include full date with year
  return format(time, "MMM do yyyy, HH:mm:ss");
};
</script>

<template>
  <div :id="`p${post.id}`" class="post" :class="{ highlight: highlight, admin: post.admin, you: post.you }">
    <div class="post-header">
      <div class="post-info">
        <span class="time">{{ formatTime(post.posted) }}</span>
        <span class="name">{{ post.name || "Anonymous" }}</span>
        <i v-if="post.admin" class="admin fa-solid fa-star" title="Room Admin"></i>
        <span v-if="post.you" class="you">(You)</span>
        <button @click="clickQuoteLink(post.id)">No.</button>
        <button @click="quotePost(post.id)">{{ post.id }}</button>
        <i v-if="post.isDeleted" class="fa-solid fa-skull-crossbones" title="Deleted"></i>
      </div>
      <div v-if="actions" class="admin-actions">
        <button
          v-if="!post.isDeleted && (post.you || roomStore.isAuthorized)"
          class="action-button"
          title="Delete post"
          @click="deletePost"
        >
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
    <div v-if="!post.isDeleted" class="post-body">
      <div v-if="post.image" class="post-image" :class="{ expanded: expandImage }">
        <a :href="post.image.url" @click.prevent="toggleExpandImage" target="_blank">
          <Image class="thumbnail" :src="post.image.tn_url" :title="post.image.filename" />
          <Image v-if="expandImage" class="expanded-image" :src="post.image.url" />
        </a>
        <div class="filename">{{ post.image.filename }}</div>
      </div>
      <PostComment :text="post.comment" @clickquotelink="clickQuoteLink" />
    </div>
  </div>
</template>

<style scoped lang="scss">
button {
  background: none;
  border: none;
  padding: 0;

  cursor: pointer !important;
}

.post-header {
  display: flex;
  flex-direction: row;

  color: gray;

  padding-bottom: 1px;

  .post-info {
    flex-grow: 1;

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3px;

    .time {
      vertical-align: top;
      text-align: right;
    }

    .name {
      vertical-align: top;
      text-align: right;
      color: #117743;
      font-weight: bold;
    }

    .admin {
      color: var(--color-admin-badge);
      font-size: 0.6rem;
    }

    .you {
      color: var(--color-post-info-you);
    }

    button {
      color: gray;
    }
  }

  .admin-actions {
    flex-shrink: 0;

    display: flex;
    flex-direction: row;
    justify-content: right;
    gap: 2px;
  }

  .action-button {
    color: rgb(78, 78, 78);
    font-size: 0.8rem;

    visibility: hidden;
  }
}

.post-image {
  display: block;
  float: left;
  overflow: hidden;
  max-width: 100%;

  .thumbnail {
    margin-right: 4px;
    max-width: 100px;
    max-height: 100px;

    // Portrait orientation
    @media screen and (max-aspect-ratio: 13/10) {
      max-width: 50px;
      max-height: 50px;
    }
  }

  .expanded-image {
    max-width: 100%;
  }

  .filename {
    display: none;
    text-align: center;
    clear: left;
    font-weight: bold;
  }

  &.expanded {
    .thumbnail {
      display: none;
    }

    .filename {
      display: block;

      color: var(--color-post-image-filename);
    }
  }
}

.post {
  background-color: var(--color-post-background);

  overflow: hidden;
  padding: 5px;

  &:nth-child(odd) {
    background-color: var(--color-post-alt-background);
  }

  &.highlight {
    background-color: var(--color-post-highlight-background);
  }

  &:hover {
    .action-button {
      visibility: visible;
    }
  }

  &.you {
    .post-header .post-info .name {
      color: var(--color-post-info-you-name);
    }
  }
}
</style>
