<script setup lang="ts">
import { ref } from "vue";

import YouTubePlayer from "youtube-player";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import videojs from "video.js";

import type { Content } from "@/models";

interface PlaybackController {
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
    meta: {
      [key: string]: any;
    };
  };
  onLoaded: (sources: Source[]) => void;
  onError: (message: string) => void;
}

const emit = defineEmits<{
  (e: "contentloaded"): void;
  (e: "play", auto: boolean): void;
  (e: "playing"): void;
  (e: "pause", auto: boolean): void;
  (e: "seek", auto: boolean, time: number): void;
  (e: "ratechange", auto: boolean, rate: number): void;
}>();

const content = ref<Content | null>(null);

let isContentLoaded = false;
let isAutoUpdate = false;
let isPlaying = false;
let isYouTubePlayerLoaded = false;
let playbackController: PlaybackController | null;

const sources = ref<Source[]>([]);

const embeddedVideo = ref<HTMLMediaElement | null>(null);
const youtubePlayer = ref<HTMLDivElement | null>(null);
const googleDriveVideo = ref<HTMLMediaElement | null>(null);

const beginAuto = () => {
  isAutoUpdate = true;

  setTimeout(() => {
    isAutoUpdate = false;
  }, 100);
};

const setContent = async (_content: Content | null) => {
  isContentLoaded = false;

  content.value = _content;
  if (content.value == null) return;

  if (content.value.type === "youtube") {
    if (isYouTubePlayerLoaded) {
      // Reload page.
      // This is a workaround for the YouTube player breaking on use.
      // Ideally a better solution should be found.
      location.reload();
    }

    setTimeout(() => {
      const ytp = YouTubePlayer(youtubePlayer.value as HTMLElement, {
        videoId: content.value?.meta.id,
      });

      isYouTubePlayerLoaded = true;

      playbackController = {
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

      isContentLoaded = true;
    }, 100);
    return;
  }

  if (content.value.type === "google_drive") {
    setTimeout(() => {
      if (!content.value) {
        return;
      }

      const embeddedVideo = googleDriveVideo.value;

      const detail: UserscriptDetails = {
        content: {
          contentType: content.value.type,
          url: content.value.url,
          meta: content.value.meta,
        },
        onLoaded: (_sources) => {
          console.log("Google Drive Userscript successfully retrieved sources.", _sources);
          sources.value = _sources;

          setTimeout(() => {
            if (!embeddedVideo) {
              return;
            }

            videojs(embeddedVideo, { controls: true });
            embeddedVideo.load();

            playbackController = {
              getTime: async (): Promise<number> => {
                return embeddedVideo.currentTime;
              },
              getRate: async (): Promise<number> => {
                return embeddedVideo.playbackRate;
              },
              setTime: (time) => {
                embeddedVideo.currentTime = time;
              },
              setRate: async (rate) => {
                embeddedVideo.playbackRate = rate;
              },
              play: () => {
                embeddedVideo.play();
              },
              pause: () => {
                embeddedVideo.pause();
              },
            };

            setTimeout(() => {
              isContentLoaded = true;
              emit("contentloaded");
            }, 1);
          }, 100);
        },
        onError: (message) => {
          alert(`Google Drive Userscript failed: ${message}`);
        },
      };

      const contentLoadingEvent = new CustomEvent("contentLoading", { detail });

      document.dispatchEvent(contentLoadingEvent);
    }, 1);
    return;
  }

  setTimeout(() => {
    if (!content.value) {
      return;
    }

    sources.value = [
      {
        url: content.value.url,
        mediaType: "",
        description: "default",
      },
    ];

    const video = embeddedVideo.value;

    setTimeout(() => {
      if (!video) {
        return;
      }

      videojs(video, { controls: true });
      video.load();

      playbackController = {
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

      isContentLoaded = true;
      emit("contentloaded");
    }, 100);
  }, 1);
};

const getIsContentLoaded = (): boolean => {
  return isContentLoaded;
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

defineExpose({
  getIsPlaying,
  setContent,
  getIsContentLoaded,
  play,
  pause,
  getTime,
  setTime,
  getRate,
  setRate,
});
</script>

<template>
  <div class="player">
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
        >
          <source v-for="source of sources" :key="source.description" :src="source.url" :type="source.mediaType" />
        </video>
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
        >
          <source v-for="source of sources" :key="source.description" :src="source.url" :type="source.mediaType" />
        </video>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/player.scss" as *;
</style>
