<script setup lang="ts">
import ratings from '~~/data/ratings/2026-fall-girls-volleyball.json'
import { isOurs } from '~/composables/useSnapshot'

useHead({
  title: 'Volleyball ratings',
  meta: [{ name: 'robots', content: 'noindex' }]
})

interface RatedTeam {
  id: string
  rank: number
  school: string
  name: string
  league: string
  tier: string | null
  division: string | null
  pool: number
  baseline: number
  rating: number
  delta: number
  record: string
  sos: number | null
}

interface Band {
  id: string
  label: string
  leagues: string[]
  teams: number
  games: number
  rankings: RatedTeam[]
}

const file = ratings as unknown as {
  generatedAt: string
  season: string
  model: { scale: string; slices: string; update: string; sos: string }
  bands: Band[]
}

const bands = file.bands
const bandId = ref(bands.find(b => b.id === '56')?.id ?? bands[0]?.id ?? '')
const league = ref('all')
const query = ref('')

watch(bandId, () => { league.value = 'all' })

const band = computed(() => bands.find(b => b.id === bandId.value) ?? bands[0])
const { sortKey, sortDir, toggle, sortBy } = useColumnSort('rating', 'desc')

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const inLeague = (band.value?.rankings ?? []).filter(team =>
    league.value === 'all' || team.league === league.value)
  const ranked = league.value === 'all'
    ? inLeague
    : inLeague.map((team, i) => ({ ...team, rank: i + 1 }))
  if (!q) return ranked
  return ranked.filter(team =>
    team.name.toLowerCase().includes(q) || team.school.toLowerCase().includes(q))
})

const sortedRows = computed(() => sortBy(rows.value, team => {
  switch (sortKey.value) {
    case 'rank': return team.rank
    case 'name': return team.name
    case 'league': return team.league
    case 'division': return team.division
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

function leagueShort (leagueName: string) {
  return leagueName.replace(/ Girls$/, '')
}

function ratingText (n: number) {
  return Math.round(n).toString()
}
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Volleyball ratings</h1>
    </div>
    <p class="muted small lead">
      {{ file.season }}. {{ file.model.scale }} {{ file.model.slices }} {{ file.model.update }}
      {{ file.model.sos }}
      Lourdes and East Side are highlighted. Updated {{ updated }}.
    </p>

    <div class="grades" role="tablist" aria-label="Grade">
      <button
        v-for="b in bands" :key="b.id" type="button" role="tab"
        :aria-selected="bandId === b.id"
        :class="{ on: bandId === b.id }"
        @click="bandId = b.id"
      >
        {{ b.label }}
      </button>
    </div>

    <div class="filters">
      <select v-if="(band?.leagues.length ?? 0) > 1" v-model="league" aria-label="League">
        <option value="all">All leagues</option>
        <option v-for="name in band?.leagues" :key="name" :value="name">{{ leagueShort(name) }}</option>
      </select>
      <input v-model="query" type="search" placeholder="School or team" aria-label="Filter by school or team">
      <p class="muted small count">{{ rows.length }} of {{ band?.teams ?? 0 }}</p>
    </div>

    <div v-if="rows.length" class="card table-wrap">
      <table>
        <thead>
          <tr>
            <SortTh class="rank" label="#" column="rank" :current="sortKey" :dir="sortDir" @sort="toggle('rank', 'asc')" />
            <SortTh label="Team" column="name" :current="sortKey" :dir="sortDir" @sort="toggle('name', 'asc')" />
            <SortTh label="League" column="league" :current="sortKey" :dir="sortDir" @sort="toggle('league', 'asc')" />
            <SortTh class="col-div" label="Div" column="division" :current="sortKey" :dir="sortDir" @sort="toggle('division', 'asc')" />
            <SortTh label="Record" column="record" numeric :current="sortKey" :dir="sortDir" @sort="toggle('record', 'desc')" />
            <SortTh label="Rating" column="rating" numeric :current="sortKey" :dir="sortDir" @sort="toggle('rating', 'desc')" />
            <SortTh label="SOS" column="sos" numeric :current="sortKey" :dir="sortDir" title="Average final rating of opponents played" @sort="toggle('sos', 'desc')" />
            <SortTh class="col-start" label="Start" column="baseline" numeric :current="sortKey" :dir="sortDir" @sort="toggle('baseline', 'desc')" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in sortedRows" :key="team.id" :class="{ 'is-ours': isOurs(team.name) }">
            <td class="rank">{{ team.rank }}</td>
            <td>{{ team.name }}</td>
            <td>{{ leagueShort(team.league) }}</td>
            <td class="col-div">{{ team.division }}</td>
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
.grades { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.grades button {
  appearance: none; border: 2px solid var(--navy); background: var(--surface);
  color: var(--navy); cursor: pointer; border-radius: 3px;
  font-family: var(--font-cond); font-weight: 700; font-size: 1rem;
  letter-spacing: .08em; text-transform: uppercase; padding: 8px 14px;
}
.grades button.on { background: var(--navy); color: #fff; }
.grades button:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
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
  .col-start, .col-div { display: none; }
}
@media (prefers-color-scheme: dark) {
  .grades button { border-color: var(--border); color: var(--text); }
  .grades button.on { background: var(--gold); color: var(--navy); border-color: var(--gold); }
  .filters input { border-color: var(--border); }
}
</style>
