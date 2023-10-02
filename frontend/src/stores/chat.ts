import { computed, ref } from "vue";
import { defineStore } from "pinia";
import axios from "axios";

import { useMainStore } from "./main";
import { useRoomStore } from "./room";

import type { Post } from "@/models";

export interface NewPost {
  name: string;
  comment: string;
  image?: File;
}

const MAX_POSTS = 200;

export const useChatStore = defineStore("chat", () => {
  const mainStore = useMainStore();
  const roomStore = useRoomStore();

  const posts = ref<Post[]>([]);
  const recentPosts = ref<Post[]>([]);

  const posting = ref(false);
  const postingProgress = ref<number>();
  const postingError = ref<string>();
  const postingCooldown = ref(0);
  const newPost = ref({
    name: roomStore.settings.chatName,
    comment: "",
  } as NewPost);

  const submitOnCooldown = ref(false);

  const canSubmitPost = computed(() => {
    // Prevent duplicate submits
    if (posting.value) {
      return false;
    }

    const post = newPost.value;
    const image = post.image;

    // Disallow posts with neither comment nor image
    if (!post.comment && !image) {
      return false;
    }

    // Disallow posting images bigger than the max image size
    if (image && image.size > mainStore.sysConfig!.max_image_size) {
      return false;
    }

    return true;
  });

  function clearNewPost() {
    const _newPost = newPost.value;

    _newPost.comment = "";
    _newPost.image = undefined;
  }

  async function submitPost() {
    if (!canSubmitPost.value) {
      return;
    }

    if (postingCooldown.value > 0) {
      submitOnCooldown.value = !submitOnCooldown.value;
      return;
    }

    const _newPost = newPost.value;

    const formData = new FormData();

    const options: string[] = [];

    if (roomStore.settings.postBadges.room_admin && roomStore.isAuthorized) {
      options.push("ra");
    }

    if (_newPost.name) {
      formData.append("name", _newPost.name);
    }

    if (_newPost.comment) {
      formData.append("comment", _newPost.comment);
    }

    if (options) {
      formData.append("options", options.join(" "));
    }

    const image = _newPost.image;
    if (image) {
      formData.append("image", image, image.name);
    }

    posting.value = true;
    postingProgress.value = undefined;
    postingError.value = undefined;

    try {
      await axios.post(`/api/chat/${roomStore.id}/post`, formData, {
        headers: await roomStore.getAuthHeaders(),
        onUploadProgress: (e) => {
          if (e.total) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            postingProgress.value = percentComplete;
          }
        },
      });

      // Clear new post
      clearNewPost();

      // Activate posting cooldown
      activatePostingCooldown();

      return true;
    } catch (err) {
      // Display the error response from the server
      postingError.value = err as string;

      return false;
    } finally {
      posting.value = false;
    }
  }

  function activatePostingCooldown() {
    postingCooldown.value = 5;
    const cooldownInterval = setInterval(() => {
      postingCooldown.value -= 1;

      if (postingCooldown.value <= 0) {
        clearInterval(cooldownInterval);

        if (submitOnCooldown.value) {
          submitOnCooldown.value = false;
          submitPost();
        }
      }
    }, 1000);
  }

  const ws_listener = roomStore.createWebsocketListener();

  ws_listener.on("post", (post: Post) => {
    const _posts = posts.value;
    if (_posts.length >= MAX_POSTS) {
      _posts.splice(0, 2);
    }

    _posts.push(post);

    recentPosts.value.push(post);
    setTimeout(() => {
      recentPosts.value.shift();
    }, 4000);
  });

  ws_listener.on("delete-post", (postId: number) => {
    const _posts = posts.value;
    const post = _posts.find((p) => p.id === postId);
    if (!post) {
      return;
    }

    post.isDeleted = true;
  });

  ws_listener.on("oldposts", (__posts: Post[]) => {
    const _posts = posts.value;
    let newPosts: Post[];
    if (_posts.length > 0) {
      const lastPost = _posts[_posts.length - 1];
      newPosts = __posts.filter((p) => p.id > lastPost.id);
    } else {
      newPosts = __posts;
    }

    _posts.push(...newPosts);
  });

  return {
    posts,
    recentPosts,
    newPost,
    canSubmitPost,
    posting,
    postingProgress,
    postingError,
    postingCooldown,
    submitOnCooldown,
    clearNewPost,
    submitPost,
  };
});
