<script setup lang="ts">
import { h, ref, toRefs, useSlots, type VNode } from "vue";

import Button from "./Button.vue";

interface TabInfo {
  index: number;
  title: string;
  content?: VNode[];
}

const props = defineProps<{
  defaultIndex?: number;
}>();

const emit = defineEmits<{
  (e: "change", newId: number, prevId: number): void;
}>();

const { defaultIndex } = toRefs(props);

const slots = useSlots();

const tabs = ref(
  slots.default?.().map((tab, index): TabInfo => {
    const title = tab.props?.title as string;
    const content = tab.children as VNode[];

    return { index, title, content };
  })
);

const selectedIndex = ref(defaultIndex?.value || 0);

const selectTab = (index: number) => {
  const prevIndex = selectedIndex.value;
  selectedIndex.value = index;

  emit("change", index, prevIndex);
};

const TabContent = () => {
  return h("div", { class: "tab-content" }, tabs.value?.[selectedIndex.value].content);
};
</script>

<template>
  <div class="tabs">
    <div class="tab-headers">
      <Button
        v-for="t in tabs"
        :key="t.index"
        class="tab-header"
        :class="selectedIndex === t.index ? 'selected' : ''"
        @click="selectTab(t.index)"
      >
        {{ t.title }}
      </Button>
    </div>
    <TabContent />
  </div>
</template>

<style scoped lang="scss">
.tabs {
  display: flex;
  flex-direction: column;
}

.tab-headers {
  flex-shrink: 0;

  display: flex;
  flex-direction: row;
  //gap: 2px;

  background-color: black;
  border-bottom: 1px solid black;

  overflow: hidden;
}

.tab-header {
  padding: 4px 16px;

  overflow: hidden;

  &.selected {
    background-color: rgb(73, 73, 73);
  }
}

.tab-content {
  flex-grow: 1;

  overflow: hidden;
}
</style>
