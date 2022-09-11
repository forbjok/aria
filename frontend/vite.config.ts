import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [basicSsl(), vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    https: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
      },
      "/f": {
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
