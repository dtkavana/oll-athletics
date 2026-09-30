<script setup lang="ts">
import ratings from '~~/data/ratings/2025-26-boys-basketball-56.json'
import { isOurs } from '~/composables/useSnapshot'

useHead({
  title: 'Basketball ratings',
  meta: [{ name: 'robots', content: 'noindex' }]
})

interface RatedTeam {
  id: string
  rank: number
  school: string
  name: string
  baseline: number
  rating: number
  record: string
  sos: number | null
}

const file = ratings as unknown as {
  generatedAt: string
  season: string
  summary: { teams: number }
  model: { scale: string; update: string; sos: string }
  rankings: RatedTeam[]
}

const query = ref('')
const { sortKey, sortDir, toggle, sortBy } = useColumnSort('rating', 'desc')

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return file.rankings
  return file.rankings.filter(team =>
    team.name.toLowerCase().includes(q) || team.school.toLowerCase().includes(q))
})

const sortedRows = computed(() => sortBy(rows.value, team => {
  switch (sortKey.value) {
    case 'rank': return team.rank
    case 'name': return team.name
    case 'record': return recordScore(team.record)
    case 'rating': return team.rating
    case 'sos': return team.sos
    case 'baseline': return team.baseline
    default: return team.rating
  }
}))

const updated = computed(() =>
  new Date(file.generatedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Indiana/Indianapolis'
  }))

function ratingText (n: number) {
  return Math.round(n).toString()
}

function ours (name: string) {
  return name === 'OLL' || isOurs(name)
}
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Basketball ratings</h1>
    </div>
    <p class="muted small lead">
      {{ file.season }}. {{ file.model.scale }} {{ file.model.update }}
      {{ file.model.sos }}
      OLL is highlighted. Updated {{ updated }}.
    </p>

    <div class="filters">
      <input v-model="query" type="search" placeholder="School or team" aria-label="Filter by school or team">
      <p class="muted small count">{{ rows.length }} of {{ file.summary.teams }}</p>
    </div>

    <div v-if="rows.length" class="card table-wrap">
      <table>
        <thead>
          <tr>
            <SortTh class="rank" label="#" column="rank" :current="sortKey" :dir="sortDir" @sort="toggle('rank', 'asc')" />
            <SortTh label="Team" column="name" :current="sortKey" :dir="sortDir" @sort="toggle('name', 'asc')" />
            <SortTh label="Record" column="record" numeric :current="sortKey" :dir="sortDir" @sort="toggle('record', 'desc')" />
            <SortTh label="Rating" column="rating" numeric :current="sortKey" :dir="sortDir" @sort="toggle('rating', 'desc')" />
            <SortTh label="SOS" column="sos" numeric :current="sortKey" :dir="sortDir" title="Average final rating of opponents played" @sort="toggle('sos', 'desc')" />
            <SortTh class="col-start" label="Start" column="baseline" numeric :current="sortKey" :dir="sortDir" @sort="toggle('baseline', 'desc')" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in sortedRows" :key="team.id" :class="{ 'is-ours': ours(team.name) }">
            <td class="rank">{{ team.rank }}</td>
            <td>{{ team.name }}</td>
            <td class="num">{{ team.record }}</td>
            <td class="num">{{ ratingText(team.rating) }}</td>
            <td class="num">{{ team.sos == null ? '—' : ratingText(team.sos) }}</td>
            <td class="num col-start muted">{{ ratingText(team.baseline) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!rows.length" class="card empty">No teams match</p>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 70ch; }
th, td { white-space: nowrap; }
.filters {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px;
}
.filters input {
  flex: 1; min-width: 12rem;
  font: inherit; color: var(--text); background: var(--surface);
  border: 2px solid var(--navy); border-radius: 3px; padding: 8px 10px;
}
.count { margin: 0; }
@media (max-width: 640px) {
  .col-start { display: none; }
}
@media (prefers-color-scheme: dark) {
  .filters input { border-color: var(--border); }
}
</style>
