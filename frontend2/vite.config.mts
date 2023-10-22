import { defineConfig } from "npm:vite@^4.5.0";
import vue from "npm:@vitejs/plugin-vue@^4.4.0";
import { fileURLToPath, URL } from "node:url";

import "@fortawesome/fontawesome-free";
import "@vueuse/core";
import "axios";
import "npm:date-fns@^2.30.0";
import "npm:filesize@^10.1.0";
import "npm:parsimmon@^1.18.1";
import "pinia";
import "sass";
import "npm:video.js@^8.5.2";
import "vue";
import "vue-router";
import "npm:youtube-player@^5.6.0";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api/": {
        target: "http://localhost:3000",
        headers: {
          "X-Forwarded-For": "127.0.0.1",
        },
      },
      "/f/": {
        target: "http://localhost:3000",
      },
      "/aria-ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
