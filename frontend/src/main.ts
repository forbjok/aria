import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";

import { LocalStorageService } from "@/services/localstorageservice";

// CSS reset
import "ress";

// Import third-party stylesheets
import "video.js/src/css/video-js.scss";

// Import main stylesheet
import "@/styles/main.scss";

const app = createApp(App);

app.use(router);

app.provide("storage", new LocalStorageService());

app.mount("#app");
