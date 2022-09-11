<script setup lang="ts">
import { h, onMounted, toRefs, useSlots } from 'vue';
import { computed, ref } from '@vue/reactivity';

//import Tab from "./Tab.vue";
interface TabInfo {
  index: number;
  title: string;
  content: any;
}

const props = defineProps<{
  defaultIndex: number;
}>();

const emit = defineEmits<{
  (e: "change", prevId: number, newId: number): void;
}>();

const { defaultIndex } = toRefs(props);

const slots = useSlots();

  const tabs = ref<TabInfo[]>([]);
  const tabHeaders = ref<any[]>([]);
  const selectedIndex = ref(-1);

const TabHeader = (p: { index: number }) => {
  if (p.index < 0) {
    return;
  }

  console.log("TH");

  return h("div", { class: "tab-header-content" }, tabs.value[p.index].title);
};

const TabContent = (p: { index: number }) => {
  if (p.index < 0) {
    return;
  }

  console.log("TC");

  return h("div", { class: "tab-content" }, tabs.value[p.index].content);
};

const selectTab = (index: number) => {
  console.log("SELECTED", index);
  selectedIndex.value = index;
};

onMounted(() => {
  tabs.value = (slots as any).default().map((t: any, ix: number) => {
    return { index: ix, content: t, title: t.props.title };
  });

  selectedIndex.value = defaultIndex.value;
});
</script>

<template>
  <div class="tabs">
    <div class="tab-headers">
      <div v-for="th of tabs" :key="th.index" class="tab-header" @click.stop="selectTab(th.index)">
        <TabHeader :index="th.index" />
      </div>
    </div>
    <TabContent :index="selectedIndex" />
  </div>
</template>

<style scoped lang="scss">
  .tabs {
    background-color: red;

    width: 500px;
    height: 500px;
  }

  .tab-headers {
    background-color: gray;

    display: flex;
    flex-direction: row;

    overflow: hidden;

    height: 24px;
  }

  .tab-header {
    padding: 5px;

    overflow: hidden;
  }
</style>
