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

let httpRequest;
if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest !== "undefined") {
  httpRequest = GM.xmlHttpRequest;
} else if (typeof GM_xmlhttpRequest !== "undefined") {
  httpRequest = GM_xmlhttpRequest;
} else {
  console.log("Unsupported userscript manager.");
}

document.addEventListener("contentLoading", (event) => {
  const detail = event.detail;
  if (detail.contentType !== "google_drive") {
    return;
  }

  const gdriveId = detail.id;

  httpRequest({
    method: "GET",
    url: `https://docs.google.com/get_video_info?authuser=&docid=${gdriveId}&sle=true&hl=en`,
    onload: (res) => {
      const values = {};

      res.responseText.split("&").forEach((pair) => {
        const parts = pair.split("=");
        values[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      });

      const links = {};
      values.fmt_stream_map.split(",").forEach((p) => {
        const parts = p.split("|");

        links[parts[0]] = parts[1];
      });

      const links2 = [];
      Object.keys(links).forEach((k) => {
        links2.push([parseInt(k), links[k]]);
      });

      links2.sort((a, b) => {
        return a[0] > b[0] ? -1 : a[0] < b[0] ? 1 : 0;
      });

      function setSrc() {
        const googleDriveVideo = document.getElementById("google-drive-video");
        if (!googleDriveVideo) {
          setTimeout(setSrc, 10);
          return;
        }

        googleDriveVideo.src = links2[0][1];
      }

      setTimeout(setSrc, 1);
    },
  });
});
