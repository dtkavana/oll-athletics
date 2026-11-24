<script setup lang="ts">
import file from '~~/data/stats/2026-27-cadet-a-oll.json'
import { formatDate, formatTime } from '~/composables/useSnapshot'
import { hasBox, resultOf, TEAM_STATS, type StatsFile } from '~/composables/useBoxScore'

const stats = file as StatsFile
const route = useRoute()
const game = stats.games.find(g => g.id === String(route.params.game) && hasBox(g))
const players = game?.players

if (!game || !players) {
  throw createError({ statusCode: 404, statusMessage: 'Box score not found', fatal: true })
}

const chip = resultOf(game)
const title = `OLL ${game.oll}–${game.opp} ${game.opponent}`

useHead({
  title,
  meta: [{ key: 'robots', name: 'robots', content: 'noindex, nofollow' }]
})

const when = formatDate(game.date, { year: 'numeric' })
const sep = game.site === 'away' ? '@' : 'vs'
const shots = game.shots ?? []
const order = ['2', '3', '13', '24', '45']
const filters = computed(() => {
  const have = new Set(shots.map(s => s.num))
  return order.flatMap(num => {
    const player = players.find(p => p.num === num)
    return player && have.has(num) ? [{ num, name: player.name }] : []
  })
})
const who = ref('all')
const shown = computed(() =>
  who.value === 'all' ? shots : shots.filter(s => s.num === who.value))
const makes = computed(() => shown.value.filter(s => s.made).length)
</script>

<template>
  <div>
    <p class="crumb">
      <NuxtLink to="/ratings">Ratings</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/2026-27/basketball">Basketball</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/ratings/basketball/cadet/oll">Cadet · OLL</NuxtLink>
    </p>

    <div class="section__head">
      <h1>OLL {{ sep }} {{ game.opponent }}</h1>
      <NuxtLink :to="TEAM_STATS">Season</NuxtLink>
    </div>
    <p class="muted small lead">
      {{ when }}<template v-if="game.startTime"> · {{ formatTime(game.startTime) }}</template>
      <template v-if="game.venue"> · {{ game.venue }}</template>
      · Final
    </p>

    <div class="final" aria-label="Final score">
      <div class="side" :class="{ 'side--win': chip?.result === 'W', 'side--loss': chip?.result === 'L' }">
        <span>OLL</span>
        <b>{{ game.oll }}</b>
      </div>
      <div class="side" :class="{ 'side--win': chip?.result === 'L', 'side--loss': chip?.result === 'W' }">
        <span>{{ game.opponent }}</span>
        <b>{{ game.opp }}</b>
      </div>
    </div>

    <section class="section">
      <div class="section__head"><h2>Box score</h2></div>
      <h3 class="table-title">Traditional</h3>
      <BoxScore mode="game" :players="players" />
      <h3 class="table-title table-title--next">Advanced</h3>
      <AdvancedBoxScore mode="game" :players="players" />
    </section>

    <section v-if="shots.length" class="section">
      <div class="section__head"><h2>Shot chart</h2></div>
      <div class="grades" role="tablist" aria-label="Shot chart">
        <button type="button" role="tab" :aria-selected="who === 'all'" :class="{ on: who === 'all' }" @click="who = 'all'">All</button>
        <button
          v-for="filter in filters" :key="filter.num" type="button" role="tab"
          :aria-selected="who === filter.num" :class="{ on: who === filter.num }"
          @click="who = filter.num"
        >{{ filter.name }}</button>
      </div>
      <div class="card chart">
        <ShotCourt :shots="shown" />
        <p class="chart__key">
          <span><i class="swatch swatch--make" /> Make</span>
          <span><i class="swatch swatch--miss" /> Miss</span>
          <span class="muted">{{ makes }} made · {{ shown.length - makes }} missed</span>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.crumb {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  margin: 0 0 10px;
  font-family: var(--font-cond); font-weight: 600; font-size: .92rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
}
.crumb a { color: inherit; text-decoration: none; }
.crumb a:hover { color: var(--navy); }
@media (prefers-color-scheme: dark) { .crumb a:hover { color: var(--gold); } }
.lead { margin: 0 0 16px; }
.final { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 22px; }
.side {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
}
.side span {
  display: block;
  font-family: var(--font-cond); font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--muted);
}
.side b {
  display: block; margin-top: 2px;
  font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.8rem);
  font-weight: 400; line-height: 1; letter-spacing: .03em;
}
.side--win { border-color: var(--win); }
.side--win b { color: var(--win); }
.side--loss { border-color: var(--border); }
.table-title {
  margin: 0 0 8px;
  color: var(--muted);
}
.table-title--next { margin-top: 18px; }
.grades { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.grades button {
  appearance: none; border: 2px solid var(--navy); background: var(--surface);
  color: var(--navy); cursor: pointer; border-radius: 3px;
  font-family: var(--font-cond); font-weight: 700; font-size: 1rem;
  letter-spacing: .06em; text-transform: uppercase; padding: 8px 14px;
}
.grades button.on { background: var(--navy); color: #fff; }
.grades button:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.chart { overflow: hidden; }
.chart__key {
  display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
  margin: 0; padding: 8px 12px;
  font-family: var(--font-cond); font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
}
.chart__key span { display: inline-flex; align-items: center; gap: 6px; }
.swatch {
  width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box;
}
.swatch--make { background: #DDB426; border: 2px solid #fff; }
.swatch--miss { background: transparent; border: 2px solid var(--text); }
@media (prefers-color-scheme: dark) {
  .grades button { border-color: var(--border); color: var(--text); }
  .grades button.on { background: var(--gold); color: var(--navy); border-color: var(--gold); }
}
</style>
