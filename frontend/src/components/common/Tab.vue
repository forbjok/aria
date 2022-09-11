<script setup lang="ts">
  import { computed } from '@vue/reactivity';
  import { onMounted, toRefs, useSlots } from 'vue';

  const props = defineProps<{
    title: string;
  }>();

  const { title } = toRefs(props);

  onMounted(() => {

  });
  </script>

  <template>
    <slot></slot>
  </template>

  <style scoped lang="scss"></style>
