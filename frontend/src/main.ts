import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";

import { LocalStorageService } from "@/services/localstorage";

// CSS reset
import "ress";

// Font-awesome
import "@fortawesome/fontawesome-free/js/fontawesome";
import "@fortawesome/fontawesome-free/js/regular";
import "@fortawesome/fontawesome-free/js/solid";

// Import third-party stylesheets
import "video.js/src/css/video-js.scss";

// Import main stylesheet
import "@/styles/main.scss";

const app = createApp(App);

app.use(router);

app.provide("storage", new LocalStorageService());

app.mount("#app");
