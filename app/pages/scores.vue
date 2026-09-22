<script setup lang="ts">
import { data, formatDate, activeSeasons } from '~/composables/useSnapshot'

useHead({ title: 'Scores' })

const seasons = activeSeasons().map(s => s.season)

/** Open on the season that actually has results, not merely the newest one. */
const lastPlayed = new Map<string, string>()
for (const g of data.games) {
  if (g.status !== 'Played') continue
  if (!lastPlayed.has(g.season) || g.date > lastPlayed.get(g.season)!) lastPlayed.set(g.season, g.date)
}
const newestWithScores = [...lastPlayed.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0]
const season = ref(newestWithScores ?? seasons[0] ?? '')

const played = computed(() =>
  data.games
    .filter(g => g.season === season.value && g.status === 'Played')
    .slice()
    .reverse())

const byDate = computed(() => {
  const m = new Map<string, typeof played.value>()
  for (const g of played.value) {
    if (!m.has(g.date)) m.set(g.date, [])
    m.get(g.date)!.push(g)
  }
  return [...m]
})
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Scores</h1>
      <select v-model="season" aria-label="Season">
        <option v-for="s in seasons" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div v-if="byDate.length" class="card">
      <template v-for="[date, games] in byDate" :key="date">
        <p class="daybar">{{ formatDate(date, { weekday: 'long', year: 'numeric' }) }}</p>
        <ul class="list">
          <GameRow v-for="g in games" :key="g.id" :game="g" :show-date="false" />
        </ul>
      </template>
    </div>
    <p v-else class="card empty">No games played yet this season.</p>
  </div>
</template>

<style scoped>
.list { margin: 0; padding: 0; list-style: none; }
</style>
