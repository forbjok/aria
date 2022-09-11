import { createRouter, createWebHistory } from "vue-router";

const ClaimView = () => import("@/views/ClaimView.vue");
const RoomView = () => import("@/views/RoomView.vue");

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
      path: "/r/:room/claim",
      name: "claim",
      component: ClaimView,
      props: true,
    },
  ],
});

export default router;
