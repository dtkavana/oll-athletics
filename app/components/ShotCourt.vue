<script setup lang="ts">
import type { ShotMark } from '~/composables/useBoxScore'

defineProps<{ shots: ShotMark[] }>()
</script>

<template>
  <svg class="court" viewBox="-80 -28 1640 1060" role="img">
    <rect x="-80" y="-28" width="1640" height="1060" fill="#186B42" />
    <rect x="469" y="0" width="537" height="637" fill="#145836" />
    <path
      d="M0 0 H1475 V479 A806 806 0 0 1 0 479 V0 Z"
      fill="none"
    />
    <rect x="469" y="0" width="537" height="637" fill="none" />
    <line x1="469" y1="637" x2="1006" y2="637" />
    <circle cx="737.5" cy="637" r="200" fill="none" />
    <line x1="634" y1="134" x2="841" y2="134" class="board" />
    <line x1="737.5" y1="134" x2="737.5" y2="151" class="board" />
    <circle cx="737.5" cy="176.5" r="25" fill="none" class="rim" />
    <circle
      v-for="(shot, i) in shots.filter(s => !s.made)"
      :key="`m${i}`"
      :cx="shot.x" :cy="shot.y" r="13"
      class="miss"
    />
    <circle
      v-for="(shot, i) in shots.filter(s => s.made)"
      :key="`k${i}`"
      :cx="shot.x" :cy="shot.y" r="12"
      class="make"
    />
  </svg>
</template>

<style scoped>
.court { display: block; width: 100%; height: auto; }
.court path,
.court rect,
.court line,
.court circle { stroke: rgba(255,255,255,.92); stroke-width: 4; }
.rim { stroke: #E7A23A; stroke-width: 5; }
.board { stroke-width: 5; }
.miss { fill: none; stroke: #F4F1E8; stroke-width: 4; }
.make { fill: #DDB426; stroke: #fff; stroke-width: 3; }
</style>
