import { defineConfig } from "npm:vite@^4.4.11";
//import basicSsl from "npm:@vitejs/plugin-basic-ssl"; // Not working with Deno currently
import vue from "npm:@vitejs/plugin-vue@^4.4.0";
import { fileURLToPath, URL } from "node:url";

import "npm:axios@^1.5.1";
import "npm:pinia@^2.1.6";
import "npm:sass@^1.69.0";
import "npm:vue@^3.3.4";
import "npm:vue-router@4";
import "npm:@fortawesome/fontawesome-free@^6.4.2";
import "npm:video.js@^8.5.2";
import "npm:@vueuse/core@^10.4.1";
import "npm:date-fns@^2.30.0";
import "npm:filesize@^10.1.0";
import "npm:parsimmon@^1.18.1";
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
    https: true,
    proxy: {
      "/api/": {
        target: "http://localhost:3000",
        xfwd: true,
      },
      "/f/": {
        target: "http://localhost:3000",
      },
      "/aria-ws": {
        target: "ws://localhost:3001",
        ws: true,
        xfwd: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
