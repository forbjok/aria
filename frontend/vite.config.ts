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
        target: "http://localhost:5000",
      },
      "/f": {
        target: "http://localhost:5000",
      },
      "/aria-ws": {
        target: "http://localhost:5000/aria-ws",
        ws: true,
      },
    },
  },
});
