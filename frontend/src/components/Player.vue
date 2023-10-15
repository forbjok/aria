<script setup lang="ts">
import { ref, watch } from "vue";

import YouTubePlayer from "youtube-player";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import videojs from "video.js";

import { ContentType, type ContentInfo } from "@/utils/content";
import { delay } from "@/utils/delay";
import type VideojsPlayer from "video.js/dist/types/player";

interface PlaybackController {
  getDuration(): Promise<number>;
  getTime(): Promise<number>;
  getRate(): Promise<number>;
  setTime(time: number): void;
  setRate(rate: number): void;
  play(): void;
  pause(): void;
}

interface Source {
  mediaType: string;
  url: string;
  description: string;
}

interface UserscriptDetails {
  content: {
    contentType: string;
    url: string;
    meta?: {
      [key: string]: any;
    };
  };
  onLoaded: (sources: Source[]) => void;
  onError: (message: string) => void;
}

const emit = defineEmits<{
  (e: "contentloaded"): void;
  (e: "contenterror"): void;
  (e: "play", auto: boolean): void;
  (e: "playing"): void;
  (e: "livestream"): void;
  (e: "pause", auto: boolean): void;
  (e: "seek", auto: boolean, time: number): void;
  (e: "ratechange", auto: boolean, rate: number): void;
}>();

const content = ref<ContentInfo>();
const contentUrl = ref<string>();

let isAutoUpdate = false;
let isPlaying = false;
let isYouTubePlayerLoaded = false;
let playbackController: PlaybackController | null;
let videojsPlayer: VideojsPlayer | null;

const isContentLoaded = ref(false);
const sources = ref<Source[]>([]);
const currentSource = ref<Source | null>();
const setSource = ref<((source: Source) => void) | null>();
const canSelectSource = ref(true);
const isControlsVisible = ref(false);

const embeddedVideo = ref<HTMLMediaElement>();
const youtubePlayer = ref<HTMLDivElement>();
const googleDriveVideo = ref<HTMLMediaElement>();

watch(isContentLoaded, () => {
  if (isContentLoaded.value) {
    emit("contentloaded");
  }
});

const beginAuto = async () => {
  isAutoUpdate = true;

  await delay(2000);
  isAutoUpdate = false;
};

const setContent = async (_content?: ContentInfo) => {
  // Dispose old Video.js player
  videojsPlayer?.dispose();
  videojsPlayer = null;

  isContentLoaded.value = false;
  currentSource.value = null;
  setSource.value = null;
  canSelectSource.value = false;

  content.value = undefined;
  if (!_content) return;

  await delay(1);

  content.value = _content;

  if (content.value.type === ContentType.YouTube) {
    if (isYouTubePlayerLoaded) {
      // Reload page.
      // This is a workaround for the YouTube player breaking on use.
      // Ideally a better solution should be found.
      location.reload();
    }

    await delay(100);

    const ytp = YouTubePlayer(youtubePlayer.value as HTMLElement, {
      videoId: content.value?.meta?.id,
    });

    isYouTubePlayerLoaded = true;

    playbackController = {
      getDuration: async (): Promise<number> => {
        return await ytp.getDuration();
      },
      getTime: async (): Promise<number> => {
        return await ytp.getCurrentTime();
      },
      getRate: async (): Promise<number> => {
        return await ytp.getPlaybackRate();
      },
      setTime: async (time) => {
        await ytp.seekTo(time, true);
      },
      setRate: async (rate) => {
        await ytp.setPlaybackRate(rate);
      },
      play: async () => {
        await ytp.playVideo();
      },
      pause: async () => {
        await ytp.pauseVideo();
      },
    };

    ytp.on("stateChange", (event) => {
      if (event.data === PlayerStates.PLAYING) {
        onPlay();
        onPlaying();
      } else if (event.data === PlayerStates.PAUSED) {
        onPause();
      }
    });

    ytp.on("playbackRateChange", () => {
      onRateChange();
    });

    ytp.on("ready", () => {
      isContentLoaded.value = true;
    });

    ytp.on("error", () => {
      emit("contenterror");
    });

    return;
  }

  if (content.value.type === ContentType.GoogleDrive) {
    await delay(1);

    if (!content.value) {
      return;
    }

    const video = googleDriveVideo.value;

    const detail: UserscriptDetails = {
      content: {
        contentType: content.value.type,
        url: content.value.url,
        meta: content.value.meta,
      },
      onLoaded: async (_sources) => {
        console.log("Google Drive Userscript successfully retrieved sources.", _sources);
        sources.value = _sources;

        await delay(100);

        if (!video) {
          return;
        }

        videojsPlayer = videojs(video, { controls: true }, () => {
          video.addEventListener(
            "canplay",
            () => {
              isContentLoaded.value = true;
            },
            { once: true },
          );

          selectSource(_sources[0]);
        });

        setSource.value = (source) => {
          videojsPlayer?.src({ src: source.url, type: source.mediaType });
        };

        canSelectSource.value = true;

        playbackController = {
          getDuration: async (): Promise<number> => {
            return video.duration;
          },
          getTime: async (): Promise<number> => {
            return video.currentTime;
          },
          getRate: async (): Promise<number> => {
            return video.playbackRate;
          },
          setTime: (time) => {
            video.currentTime = time;
          },
          setRate: async (rate) => {
            video.playbackRate = rate;
          },
          play: () => {
            video.play();
          },
          pause: () => {
            video.pause();
          },
        };
      },
      onError: (message) => {
        alert(`Google Drive Userscript failed: ${message}`);
      },
    };

    const contentLoadingEvent = new CustomEvent("contentLoading", { detail });

    document.dispatchEvent(contentLoadingEvent);

    return;
  }

  if (content.value.type === ContentType.Twitch) {
    playbackController = null;

    contentUrl.value = `https://player.twitch.tv/?channel=${content.value.meta?.channel}&parent=${window.location.hostname}`;
    isContentLoaded.value = true;

    emit("livestream");
    return;
  }

  await delay(1);

  if (!content.value) {
    return;
  }

  const source = {
    url: content.value.url,
    mediaType: "",
    description: "Source",
  };

  sources.value = [source];

  const video = embeddedVideo.value;

  await delay(100);

  if (!video) {
    return;
  }

  videojsPlayer = videojs(video, { controls: true }, () => {
    video.addEventListener(
      "canplay",
      () => {
        isContentLoaded.value = true;
      },
      { once: true },
    );

    selectSource(source);
  });

  setSource.value = (source) => {
    videojsPlayer?.src({ src: source.url, type: source.mediaType });
  };

  playbackController = {
    getDuration: async (): Promise<number> => {
      return video.duration;
    },
    getTime: async (): Promise<number> => {
      return video.currentTime;
    },
    getRate: async (): Promise<number> => {
      return video.playbackRate;
    },
    setTime: (time) => {
      video.currentTime = time;
    },
    setRate: async (rate) => {
      video.playbackRate = rate;
    },
    play: () => {
      video.play();
    },
    pause: () => {
      video.pause();
    },
  };
};

const getIsContentLoaded = (): boolean => {
  return isContentLoaded.value;
};

const getIsPlaying = (): boolean => {
  return isPlaying;
};

const play = async () => {
  beginAuto();

  return await playbackController?.play();
};

const pause = async () => {
  beginAuto();

  return await playbackController?.pause();
};

const getDuration = async (): Promise<number> => {
  return (await playbackController?.getDuration()) || 0;
};

const getTime = async (): Promise<number> => {
  return (await playbackController?.getTime()) || 0;
};

const getRate = async (): Promise<number> => {
  return (await playbackController?.getRate()) || 1;
};

const setTime = (time: number) => {
  beginAuto();

  playbackController?.setTime(time);
};

const setRate = (rate: number) => {
  beginAuto();

  playbackController?.setRate(rate);
};

const onPlay = async () => {
  isPlaying = true;
  emit("play", isAutoUpdate);
};

const onPlaying = async () => {
  emit("playing");
};

const onPause = async () => {
  isPlaying = false;

  // If playback stops due to reaching the end of the content,
  // treat it as automatic.
  const duration = await playbackController?.getDuration();
  const time = await playbackController?.getTime();
  if (!!duration && !!time && duration - time < 1) {
    beginAuto();
  }

  emit("pause", isAutoUpdate);
};

const onSeek = async () => {
  if (!playbackController) {
    return;
  }

  emit("seek", true, await playbackController.getTime());
};

const onRateChange = async () => {
  if (!playbackController) {
    return;
  }

  emit("ratechange", true, await playbackController.getRate());
};

const selectSource = (source: Source) => {
  currentSource.value = source;

  if (!setSource.value) {
    return;
  }

  setSource.value(source);
};

let showControlsTimeout: number | null;
const showControls = () => {
  if (!canSelectSource.value) {
    return;
  }

  isControlsVisible.value = true;

  if (showControlsTimeout) {
    clearTimeout(showControlsTimeout);
  }

  showControlsTimeout = setTimeout(() => {
    isControlsVisible.value = false;
    showControlsTimeout = null;
  }, 2500);
};

const onMouseMove = () => {
  showControls();
};

const onTouchStart = () => {
  showControls();
};

const isSourceListOpen = ref(false);
const openSourceList = () => {
  isSourceListOpen.value = true;
};

const closeSourceList = () => {
  isSourceListOpen.value = false;
};

watch(isControlsVisible, (v) => {
  if (!v) {
    return;
  }

  isSourceListOpen.value = false;
});

defineExpose({
  getIsPlaying,
  setContent,
  getIsContentLoaded,
  play,
  pause,
  getDuration,
  getTime,
  setTime,
  getRate,
  setRate,
});
</script>

<template>
  <div class="player" @mousemove="onMouseMove" @touchstart="onTouchStart">
    <div v-if="canSelectSource" v-show="isControlsVisible" class="source-selector" @mouseleave="closeSourceList">
      <div v-show="isSourceListOpen" class="source-list">
        <button
          v-for="source of sources"
          :key="source.description"
          class="source"
          :class="{ selected: source === currentSource }"
          @click="selectSource(source)"
        >
          {{ source.description }}
        </button>
      </div>
      <div class="current-source" :class="{ open: isSourceListOpen }" @click="openSourceList">
        {{ currentSource?.description }}
      </div>
    </div>
    <div v-if="!!content" class="video-container">
      <div v-if="content.type == 'unknown'" class="video-container">
        <video
          controls
          ref="embeddedVideo"
          class="video-container video-js"
          @play="onPlay"
          @playing="onPlaying"
          @pause="onPause"
          @seeked="onSeek"
          @ratechange="onRateChange"
        ></video>
      </div>
      <div v-if="content.type == 'youtube'" class="video-container">
        <div ref="youtubePlayer" class="video-container youtube-player"></div>
      </div>
      <div v-if="content.type == 'google_drive'" class="video-container">
        <video
          controls
          ref="googleDriveVideo"
          class="video-container video-js"
          @play="onPlay"
          @playing="onPlaying"
          @pause="onPause"
          @seeked="onSeek"
          @ratechange="onRateChange"
        ></video>
      </div>
      <iframe
        v-if="content.type == 'twitch'"
        class="video-container"
        :src="contentUrl"
        frameborder="0"
        allowfullscreen="true"
        scrolling="no"
      ></iframe>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-container {
  background-color: black;
  height: 100%;
  width: 100%;
}

:deep(.youtube-player) {
  height: 100%;
  width: 100%;
}

.unsupported-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
  cursor: default;

  text-align: center;
  font-size: 2rem;
  color: #9e9e9e;
}

.source-selector {
  z-index: 999;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;

  position: absolute;
  left: 10px;
  bottom: 40px;

  .source-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .source {
    background-color: black;
    color: white;

    border: 0;
    border-radius: 3px;
    opacity: 0.4;

    padding: 0.2rem 0.3rem;

    &.selected {
      opacity: 0.8;
    }
  }

  button.source {
    &:not(.selected):hover {
      opacity: 0.6;
    }
  }

  .current-source {
    @extend .source;

    cursor: default;

    &:hover {
      opacity: 0.6;
    }

    &.open {
      opacity: 1;
    }
  }
}
</style>
