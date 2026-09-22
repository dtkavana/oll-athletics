<script setup lang="ts">
import type { Game } from '~/composables/useSnapshot'
defineProps<{ games: Game[]; perspective?: string; empty?: string }>()
</script>

<template>
  <div class="card">
    <ul v-if="games.length" class="list">
      <GameRow v-for="g in games" :key="g.id" :game="g" :perspective="perspective" />
    </ul>
    <p v-else class="empty">{{ empty ?? 'Nothing scheduled.' }}</p>
  </div>
</template>

<style scoped>
.list { margin: 0; padding: 0; }
</style>
