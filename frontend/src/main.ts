import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";

import { LocalStorageService } from "@/services/localstorageservice";

// Import video.js stylesheet
import "video.js/src/css/video-js.scss";

const app = createApp(App);

app.use(router);

app.provide("storage", new LocalStorageService());

app.mount("#app");
