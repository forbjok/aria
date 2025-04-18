<script setup lang="ts">
import { computed, ref } from "vue";

import { filesize } from "filesize";

import { useMainStore } from "@/stores/main";
import { type NewEmote, useRoomStore } from "@/stores/room";

import type { Emote } from "@/models";

import Button from "@/components/common/Button.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import Dialog from "@/components/common/Dialog.vue";
import Image from "@/components/common/Image.vue";
import Toolbar from "@/components/common/Toolbar.vue";

const UPLOADING_TEXT = "Uploading...";

const mainStore = useMainStore();
const roomStore = useRoomStore();

const addEmoteDialog = ref<typeof Dialog>();
const confirmDelete = ref<typeof ConfirmDialog>();
const emoteDetailsDialog = ref<typeof Dialog>();

const adding = ref(false);
const errorText = ref<string>();
const progressText = ref<string>();
const newEmote = ref<NewEmote>({ name: "" });
const selectedEmote = ref<Emote>();

const emotes = computed((): Emote[] => {
  if (!roomStore.exists) {
    return [];
  }

  return Object.keys(roomStore.emotes)
    .sort()
    .map((n) => roomStore.emotes[n]);
});

const newEmoteImage = computed((): string | undefined => {
  const _newEmote = newEmote.value;
  if (!_newEmote || !_newEmote.image) {
    return;
  }

  if (!_newEmote.image.type.startsWith("image/")) {
    return;
  }

  return URL.createObjectURL(_newEmote.image);
});

const newEmoteVideo = computed((): string | undefined => {
  const _newEmote = newEmote.value;
  if (!_newEmote || !_newEmote.image) {
    return;
  }

  if (!_newEmote.image.type.startsWith("video/")) {
    return;
  }

  return URL.createObjectURL(_newEmote.image);
});

const addEmote = () => {
  newEmote.value = { name: "" };
  addEmoteDialog.value?.show();
};

const showEmoteDetails = (emote: Emote) => {
  selectedEmote.value = emote;
  emoteDetailsDialog.value?.show();
};

const deleteEmote = async (emote?: Emote) => {
  if (!emote) {
    return;
  }

  try {
    await roomStore.deleteEmote(emote.id);

    selectedEmote.value = undefined;
    emoteDetailsDialog.value?.close();
  } catch (err) {
    errorText.value = err as string;
  }
};

const imageSelected = (event: Event) => {
  const _newEmote = newEmote.value;
  if (!_newEmote) {
    return;
  }

  const input = event.target as HTMLInputElement;
  if (!input || !input.files) return;

  const image = input.files[0];

  const max_file_size = mainStore.sysConfig!.max_emote_size;
  if (image && image.size > max_file_size) {
    alert(`The selected file is bigger than the maximum allowed size of ${filesize(max_file_size)}`);
    return;
  }

  _newEmote.image = image;
};

const canSubmitEmote = computed(() => {
  if (adding.value) {
    return false;
  }

  const _newEmote = newEmote.value;
  return !!_newEmote && _newEmote.name.length > 0 && !!_newEmote.image;
});

const submitEmote = async () => {
  const _newEmote = newEmote.value;
  if (!_newEmote || _newEmote.name.length <= 0 || !_newEmote.image) {
    return;
  }

  adding.value = true;
  errorText.value = undefined;
  progressText.value = UPLOADING_TEXT;

  try {
    await roomStore.submitEmote(_newEmote, (e) => {
      if (e.total) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        progressText.value = `${percentComplete}%`;
      } else {
        progressText.value = UPLOADING_TEXT;
      }
    });

    addEmoteDialog.value?.close();
  } catch (err) {
    errorText.value = err as string;
  } finally {
    adding.value = false;
  }
};
</script>

<template>
  <div class="emote-admin">
    <div class="content">
      <div class="emotes">
        <div v-for="e of emotes" :key="e.name" :value="e.name" class="emote" @click="showEmoteDetails(e)">
          <div class="emote-image">
            <Image class="image" :src="e.url" />
          </div>
          <div class="caption">
            {{ e.name }}
          </div>
        </div>
      </div>
    </div>
    <Toolbar>
      <Button @click="addEmote"> <i class="fa-solid fa-plus"></i> Add emote</Button>
    </Toolbar>

    <!-- Dialogs -->
    <Dialog ref="emoteDetailsDialog" title="Emote details">
      <div v-if="selectedEmote" class="emote-details">
        <div class="content">
          <div class="emote-image">
            <Image class="image" :src="selectedEmote.url" />
          </div>
          <div class="caption">
            {{ selectedEmote.name }}
          </div>
        </div>
        <Toolbar>
          <Button @click="confirmDelete?.show()"><i class="fa-solid fa-trash"></i> Delete</Button>
        </Toolbar>
      </div>
    </Dialog>

    <Dialog ref="addEmoteDialog" title="Add emote">
      <form class="add-form dialog-content" @submit.prevent="submitEmote">
        <input
          name="name"
          type="text"
          pattern="^[\d\w\-]+$"
          v-model="newEmote.name"
          placeholder="Emote name"
          title="Emote name. Only alphanumeric characters allowed."
          :disabled="adding"
        />
        <input
          name="image"
          type="file"
          accept="image/*, video/webm, video/mp4"
          @change="imageSelected"
          :disabled="adding"
        />
        <img v-show="newEmoteImage" class="image-preview" :src="newEmoteImage" alt="Preview" />
        <video
          v-show="newEmoteVideo"
          class="image-preview"
          :src="newEmoteVideo"
          alt="Preview"
          autoplay
          loop
          muted
        ></video>
        <button class="add-button" type="submit" :disabled="!canSubmitEmote">
          {{ adding ? progressText : "Upload" }}
        </button>
        <span v-if="!!errorText">{{ errorText }}</span>
      </form>
    </Dialog>

    <ConfirmDialog ref="confirmDelete" title="Confirm delete" @confirm="deleteEmote(selectedEmote)">
      <template v-slot:confirm><i class="fa-solid fa-trash"></i> Delete</template>
      <div class="confirm-delete-dialog">
        Are you sure you want to delete <b>{{ selectedEmote?.name }}</b>
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped lang="scss">
:global(:root) {
  --color-caption-background: rgb(65, 65, 65);
  --color-emote-image-background: rgb(13, 13, 13);

  --color-caption-hover-background: rgb(82, 82, 82);
  --color-emote-image-hover-background: rgb(22, 22, 22);
}

.emote-admin {
  background-color: var(--color-dialog-background);

  display: flex;
  flex-direction: column;

  width: 100%;
  height: 100%;

  overflow: hidden;
}

.caption {
  text-align: center;
  background-color: var(--color-caption-background);

  padding: 2px;

  width: 100%;
}

.content {
  flex-grow: 1;

  overflow-y: auto;
}

.dialog-content {
  padding: 10px;
}

.toolbar {
  flex-shrink: 0;

  justify-content: flex-end;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 5px;

  .image-preview {
    max-width: 350px;
    max-height: 350px;
  }
}

.confirm-delete-dialog {
  min-width: 300px;
  min-height: 50px;
}

.emote-image {
  background-color: var(--color-emote-image-background);
  display: flex;
  justify-content: center;

  img {
    align-self: center;
  }
}

.emotes {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 5px;

  padding: 10px;

  overflow-x: hidden;
  overflow-y: auto;

  width: 100%;

  .emote {
    display: flex;
    flex-direction: column;

    cursor: pointer;

    &:hover {
      --color-emote-image-background: var(--color-emote-image-hover-background);
      --color-caption-background: var(--color-caption-hover-background);
    }

    .emote-image {
      display: flex;
      align-items: center;

      width: 100px;
      height: 100px;

      .image {
        max-width: 100px;
        max-height: 100px;
      }
    }
  }
}

.emote-details {
  display: flex;
  flex-direction: column;

  .content {
    padding: 10px;
  }

  .emote-image {
    max-width: 350px;
    max-height: 350px;

    overflow: hidden;

    .image {
      max-width: 350px;
      max-height: 350px;
    }
  }
}
</style>
