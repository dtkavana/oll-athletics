<script setup lang="ts">
import {
  data, TODAY, formatDate, isCampusHomeGame
} from '~/composables/useSnapshot'

useHead({ title: '@ OLL' })

const homeUpcoming = computed(() =>
  data.games
    .filter(g => g.date >= TODAY && g.status !== 'Played' && isCampusHomeGame(g))
    .sort((a, b) =>
      a.date.localeCompare(b.date)
      || (a.startTime ?? '').localeCompare(b.startTime ?? '')))

const homeByDate = computed(() => {
  const m = new Map<string, typeof homeUpcoming.value>()
  for (const g of homeUpcoming.value) {
    if (!m.has(g.date)) m.set(g.date, [])
    m.get(g.date)!.push(g)
  }
  return [...m.entries()]
})
</script>

<template>
  <div>
    <div class="section__head">
      <h1>@ OLL</h1>
    </div>
    <p class="muted small lead">
      Home games at Lourdes or Scecina &mdash; listed top to bottom by date.
    </p>

    <div v-if="homeByDate.length" class="card">
      <template v-for="[date, games] in homeByDate" :key="date">
        <p class="daybar" :class="{ 'daybar--today': date === TODAY }">
          <span>{{ formatDate(date, { weekday: 'long' }) }}</span>
          <span>{{ games.length }} game<template v-if="games.length !== 1">s</template></span>
        </p>
        <ul class="list">
          <GameRow v-for="g in games" :key="g.id" :game="g" :show-date="false" />
        </ul>
      </template>
    </div>
    <p v-else class="card empty">No home games scheduled at Lourdes or Scecina</p>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 52ch; }
.list { margin: 0; padding: 0; list-style: none; }
</style>
