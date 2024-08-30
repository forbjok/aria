import { defineConfig } from "@rsbuild/core";
import { pluginSass } from "@rsbuild/plugin-sass";
import { pluginVue } from "@rsbuild/plugin-vue";
import { pluginBasicSsl } from "@rsbuild/plugin-basic-ssl";

export default defineConfig({
  plugins: [pluginSass(), pluginVue(), pluginBasicSsl()],
  source: {
    alias: {
      "@": "./src",
    },
  },
  html: {
    template: "./index.html",
    favicon: "./favicon.ico",
  },
  server: {
    port: 5173,
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
});
