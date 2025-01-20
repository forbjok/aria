export enum ContentType {
  YouTube = "youtube",
  GoogleDrive = "google_drive",
  Twitch = "twitch",
  Unknown = "unknown",
}

export enum ContentKind {
  Video = "video",
  Livestream = "stream",
  LivestreamOrVod = "livestream_or_vod",
}

export interface ContentInfo {
  type: ContentType;
  kind: ContentKind;
  url: string;
  meta?: {
    [key: string]: any;
  };
}

const RE_YOUTUBE_URL = /https?:\/\/(?:www|m)\.youtube\.com\/watch\?v=([^&]+)/;
const RE_GDRIVE_URL = /https?:\/\/drive\.google\.com\/file\/d\/(.+)\/view/;
const RE_TWITCH_URL = /https?:\/\/(?:www\.)?twitch\.tv\/([^#\?]+)/;

export function getContentInfo(url: string): ContentInfo {
  const youTubeMatch = url.match(RE_YOUTUBE_URL);
  if (youTubeMatch) {
    const youTubeId = youTubeMatch[1];

    return {
      type: ContentType.YouTube,
      kind: ContentKind.Video,
      url,
      meta: {
        id: youTubeId,
      },
    };
  }

  const gdriveMatch = url.match(RE_GDRIVE_URL);
  if (gdriveMatch) {
    const gdriveId = gdriveMatch[1];

    return {
      type: ContentType.GoogleDrive,
      kind: ContentKind.Video,
      url,
      meta: {
        id: gdriveId,
      },
    };
  }

  const twitchMatch = url.match(RE_TWITCH_URL);
  if (twitchMatch) {
    const channelName = twitchMatch[1];

    return {
      type: ContentType.Twitch,
      kind: ContentKind.Livestream,
      url,
      meta: {
        channel: channelName,
      },
    };
  }

  if (url.endsWith(".m3u8")) {
    return {
      type: ContentType.Unknown,
      kind: ContentKind.LivestreamOrVod,
      url,
    };
  }

  return {
    type: ContentType.Unknown,
    kind: ContentKind.Video,
    url,
  };
}
