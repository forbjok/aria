<script setup lang="ts">
import Tab from "../common/Tab.vue";
import Tabs from "../common/Tabs.vue";
import EmoteAdmin from "./EmoteAdmin.vue";
</script>

<template>
  <div class="admin-panel">
    <Tabs>
      <Tab title="Emotes">
        <EmoteAdmin />
      </Tab>
    </Tabs>
  </div>
</template>

<style scoped lang="scss">
.admin-panel {
  border: 1px solid black;

  overflow: hidden;

  .tabs {
    width: 100%;
    height: 100%;
  }
}
</style>
