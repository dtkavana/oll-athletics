<script setup lang="ts">
const props = defineProps<{
  label: string
  column: string
  current: string
  dir: 'asc' | 'desc'
  numeric?: boolean
}>()

defineEmits<{ sort: [] }>()

const ariaSort = computed(() => {
  if (props.current !== props.column) return 'none'
  return props.dir === 'asc' ? 'ascending' : 'descending'
})
</script>

<template>
  <th :class="{ num: numeric }" :aria-sort="ariaSort">
    <button type="button" class="sort" @click="$emit('sort')">{{ label }}</button>
  </th>
</template>
