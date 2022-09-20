<script setup lang="ts">
import { computed, inject, ref } from "vue";

import axios from "axios";
import filesize from "filesize";

import type { Emote } from "@/models";
import type { RoomAuthService } from "@/services/room-auth";

import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import Button from "@/components/common/Button.vue";
import Dialog from "@/components/common/Dialog.vue";
import Toolbar from "@/components/common/Toolbar.vue";
import type { RoomService } from "@/services/room";

interface NewEmote {
  name: string;
  image?: File;
}

const MAX_IMAGE_SIZE = 2097152;
const UPLOADING_TEXT = "Uploading...";

const auth = inject<RoomAuthService>("auth");
const room = inject<RoomService>("room");

const addEmoteDialog = ref<typeof Dialog>();
const confirmDelete = ref<typeof ConfirmDialog>();
const emoteDetailsDialog = ref<typeof Dialog>();

const adding = ref(false);
const errorText = ref<string>();
const progressText = ref<string>();
const newEmote = ref<NewEmote>({ name: "" });
const selectedEmote = ref<Emote | undefined>();

const emotes = computed((): Emote[] => {
  if (!room) {
    return [];
  }

  return Object.keys(room.emotes.value)
    .sort()
    .map((n) => room.emotes.value[n]);
});

const newEmoteImage = computed((): string | undefined => {
  const _newEmote = newEmote.value;
  if (!_newEmote || !_newEmote.image) {
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
    await axios.delete(`/api/chat/${room?.id}/emote/${emote.id}`, {
      headers: {
        Authorization: `Bearer ${auth?.getToken()}`,
      },
    });

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

  if (image && image.size > MAX_IMAGE_SIZE) {
    alert(`The selected file is bigger than the maximum allowed size of ${filesize(MAX_IMAGE_SIZE)}`);
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
  progressText.value = undefined;

  const formData = new FormData();
  formData.append("name", _newEmote.name);
  formData.append("image", _newEmote.image, _newEmote.image.name);

  progressText.value = UPLOADING_TEXT;

  try {
    await axios.post(`/api/chat/${room?.id}/emote`, formData, {
      headers: {
        Authorization: `Bearer ${auth?.getToken()}`,
      },
      onUploadProgress: (e: ProgressEvent) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          progressText.value = `${percentComplete}%`;
        } else {
          progressText.value = UPLOADING_TEXT;
        }
      },
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
            <img :src="e.url" :title="e.name" />
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
      <div class="emote-details">
        <div class="content">
          <div class="emote-image">
            <img :src="selectedEmote?.url" :title="selectedEmote?.name" />
          </div>
          <div class="caption">
            {{ selectedEmote?.name }}
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
          pattern="^[\d\w-]+$"
          v-model="newEmote.name"
          placeholder="Emote name"
          title="Emote name. Only alphanumeric characters allowed."
          :disabled="adding"
        />
        <input name="image" type="file" accept="image/*" @change="imageSelected" :disabled="adding" />
        <img v-show="newEmoteImage" class="image-preview" :src="newEmoteImage" alt="Preview" />
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
@use "@/styles/dialog.scss" as *;

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
      width: 100px;
      height: 100px;

      img {
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

    img {
      max-width: 350px;
      max-height: 350px;
    }
  }
}
</style>
