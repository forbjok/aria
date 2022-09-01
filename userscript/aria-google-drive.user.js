// ==UserScript==
// @name         Aria Google Drive Support
// @namespace    https://aria.us.to/
// @version      0.1
// @description  Required to support Google Drive in Aria, due to CORS cockblock making it impossible to retrieve URLs directly in the webapp.
// @author       Forb.Jok
// @match        https://aria.us.to/r/*
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// ==/UserScript==

const ITAG_RESOLUTION = {
  37: 1080,
  46: 1080,
  22: 720,
  45: 720,
  59: 480,
  44: 480,
  35: 480,
  18: 360,
  43: 360,
  34: 360,
};

const ITAG_TYPE = {
  43: "video/webm",
  44: "video/webm",
  45: "video/webm",
  46: "video/webm",
  18: "video/mp4",
  22: "video/mp4",
  37: "video/mp4",
  59: "video/mp4",
  35: "video/flv",
  34: "video/flv",
};

function log(msg) {
  console.log(`Aria Google Drive Userscript: ${msg}`);
}

let httpRequest;
if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest !== "undefined") {
  httpRequest = GM.xmlHttpRequest;
} else if (typeof GM_xmlhttpRequest !== "undefined") {
  httpRequest = GM_xmlhttpRequest;
} else {
  log("Unsupported userscript manager.");
}

document.addEventListener("contentLoading", (event) => {
  log("ContentLoading event received.");

  const detail = event.detail;
  const content = detail.content;

  if (content.contentType !== "google_drive") {
    log("Not Google Drive content. Returning.");
    return;
  }

  const gdriveId = content.meta.id;

  log("Requesting video info...");
  httpRequest({
    method: "GET",
    url: `https://docs.google.com/get_video_info?authuser=&docid=${gdriveId}&sle=true&hl=en`,
    onload: (res) => {
      log("Got response.", res);

      const values = {};

      res.responseText.split("&").forEach((pair) => {
        const parts = pair.split("=");
        values[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      });

      log("Extracted values.", values);

      const links = {};
      values.fmt_stream_map.split(",").forEach((p) => {
        const parts = p.split("|");

        links[parts[0]] = parts[1];
      });

      const sources = [];
      Object.keys(links).forEach((k) => {
        sources.push({
          url: links[k],
          mediaType: ITAG_TYPE[k],
          description: `${ITAG_RESOLUTION[k]}p`,
        });
      });

      log("Constructed sources.", sources);
      detail.onLoaded(sources);
    },
  });
});
