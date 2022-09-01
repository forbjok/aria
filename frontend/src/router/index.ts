import { createRouter, createWebHistory } from "vue-router";
import ClaimView from "@/views/ClaimView.vue";
import RoomView from "@/views/RoomView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/r/:name",
      name: "room",
      component: RoomView,
      props: true,
    },
    {
      path: "/r/:name/claim",
      name: "claim",
      component: ClaimView,
      props: true,
    },
  ],
});

export default router;
