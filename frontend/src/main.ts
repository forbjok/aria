import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";
import { createPinia } from "pinia";

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

// Import theme stylesheets
import "@/styles/theme/dark.scss";
import "@/styles/theme/yotsubab.scss";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");
