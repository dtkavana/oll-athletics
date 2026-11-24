<script setup lang="ts">
import file from '~~/data/stats/2026-27-cadet-a-oll.json'
import { formatDate, formatTime } from '~/composables/useSnapshot'
import {
  hasBox, resultOf, seasonLines, TEAM_STATS,
  type StatsFile, type StatsGame
} from '~/composables/useBoxScore'

const stats = file as StatsFile

useHead({
  title: 'Cadet A · OLL',
  meta: [{ key: 'robots', name: 'robots', content: 'noindex, nofollow' }]
})

const games = stats.games
const played = computed(() => games.filter(g => g.oll != null && g.opp != null))
const record = computed(() => {
  let w = 0, l = 0, t = 0, pf = 0, pa = 0
  for (const g of played.value) {
    pf += g.oll!
    pa += g.opp!
    if (g.oll! > g.opp!) w += 1
    else if (g.oll! < g.opp!) l += 1
    else t += 1
  }
  return { w, l, t, pf, pa }
})
const overall = computed(() => seasonLines(games))

function when (game: StatsGame) {
  return formatDate(game.date, { year: 'numeric' })
}

function sep (game: StatsGame) {
  return game.site === 'away' ? '@' : 'vs'
}

function gameTo (game: StatsGame) {
  return `${TEAM_STATS}/${game.id}`
}

function chip (game: StatsGame) {
  return resultOf(game)
}
</script>

<template>
  <div>
    <p class="crumb">
      <NuxtLink to="/ratings">Ratings</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/2026-27/basketball">Basketball</NuxtLink>
      <span aria-hidden="true">/</span>
      <span>Cadet</span>
    </p>

    <div class="section__head">
      <h1>Cadet A · OLL</h1>
      <NuxtLink to="/2026-27/basketball">Basketball ratings</NuxtLink>
    </div>
    <p class="muted small lead">
      {{ stats.season }}. Division {{ stats.division }}. Coach {{ stats.coach }}.
    </p>

    <p class="rec">
      <span class="rec__wl">{{ record.w }}<i>&ndash;</i>{{ record.l }}<template v-if="record.t"><i>&ndash;</i>{{ record.t }}</template></span>
      <span class="rec__pts">{{ record.pf }} scored · {{ record.pa }} allowed</span>
    </p>

    <section class="section">
      <div class="section__head"><h2>Schedule</h2></div>
      <div class="card">
        <ul class="list">
          <li v-for="game in games" :key="game.id">
            <NuxtLink v-if="hasBox(game)" class="sched sched--link" :to="gameTo(game)">
              <span class="sched__when">
                <span class="sched__date">{{ when(game) }}</span>
                <span class="sched__time">{{ formatTime(game.startTime) }}</span>
              </span>
              <span class="sched__main">
                <span class="sched__match">
                  <span class="ours">OLL</span>
                  <span class="vs" :class="{ 'vs--at': game.site === 'away' }">{{ sep(game) }}</span>
                  <span>{{ game.opponent }}</span>
                </span>
                <span class="sched__meta">
                  <span v-if="game.venue">{{ game.venue }}</span>
                  <span>Box score</span>
                </span>
              </span>
              <span v-if="chip(game)" class="sched__score">
                <span class="scorebox" :class="`scorebox--${chip(game)!.result.toLowerCase()}`">
                  <b>{{ chip(game)!.result }}</b>
                  <span class="scorebox__n">{{ chip(game)!.oll }}&ndash;{{ chip(game)!.opp }}</span>
                </span>
              </span>
            </NuxtLink>
            <div v-else class="sched">
              <span class="sched__when">
                <span class="sched__date">{{ when(game) }}</span>
                <span class="sched__time">{{ formatTime(game.startTime) }}</span>
              </span>
              <span class="sched__main">
                <span class="sched__match">
                  <span class="ours">OLL</span>
                  <span class="vs" :class="{ 'vs--at': game.site === 'away' }">{{ sep(game) }}</span>
                  <span>{{ game.opponent }}</span>
                </span>
                <span v-if="game.venue" class="sched__meta">{{ game.venue }}</span>
              </span>
              <span class="sched__score">
                <span v-if="chip(game)" class="scorebox" :class="`scorebox--${chip(game)!.result.toLowerCase()}`">
                  <b>{{ chip(game)!.result }}</b>
                  <span class="scorebox__n">{{ chip(game)!.oll }}&ndash;{{ chip(game)!.opp }}</span>
                </span>
                <span v-else class="upcoming">Upcoming</span>
              </span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Overall</h2></div>
      <template v-if="overall.length">
        <h3 class="table-title">Traditional</h3>
        <BoxScore mode="season" :players="overall" />
        <h3 class="table-title table-title--next">Advanced</h3>
        <AdvancedBoxScore mode="season" :players="overall" :team-games="played.length" />
      </template>
      <p v-else class="card empty">No box scores yet.</p>
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
.lead { margin: 0 0 14px; max-width: 70ch; }
.table-title {
  margin: 0 0 8px;
  color: var(--muted);
}
.table-title--next { margin-top: 18px; }
.rec { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; margin: 0 0 22px; }
.rec__wl {
  font-family: var(--font-display); font-size: 2.2rem; letter-spacing: .04em; line-height: 1;
}
.rec__wl i { color: var(--muted); font-style: normal; margin: 0 2px; }
.rec__pts { font-family: var(--font-cond); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.list { list-style: none; margin: 0; padding: 0; }
.list > li { border-bottom: 1px solid var(--border); }
.list > li:last-child { border-bottom: 0; }
.sched {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 14px;
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
}
.sched--link:hover { background: var(--bg-alt); }
.sched--link:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; }
.sched__when { display: flex; gap: 8px; align-items: baseline; }
.sched__date {
  font-family: var(--font-cond); font-weight: 600; font-size: .95rem;
  letter-spacing: .06em; text-transform: uppercase;
}
.sched__time { font-family: var(--font-cond); font-size: .92rem; color: var(--muted); }
.sched__match {
  display: block;
  font-family: var(--font-cond); font-weight: 700; font-size: 1.12rem;
  letter-spacing: .03em; text-transform: uppercase; line-height: 1.25;
}
.vs { color: var(--muted); font-size: .8rem; margin: 0 5px; }
.vs--at { color: var(--navy); font-weight: 700; font-size: .95rem; }
@media (prefers-color-scheme: dark) { .vs--at { color: var(--gold); } }
.ours { color: var(--navy); }
@media (prefers-color-scheme: dark) { .ours { color: var(--gold); } }
.sched__meta {
  display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 3px;
  font-family: var(--font-cond); font-size: .88rem; color: var(--muted); letter-spacing: .04em;
}
.sched__score { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
.upcoming {
  font-family: var(--font-cond); font-weight: 600; font-size: .84rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
}
.scorebox {
  display: inline-flex; align-items: stretch; border-radius: 3px; overflow: hidden;
  font-family: var(--font-display); line-height: 1;
}
.scorebox b { padding: 6px 7px; color: #fff; font-size: .9rem; }
.scorebox__n {
  padding: 6px 9px; background: var(--navy); color: #fff;
  font-size: 1.05rem; font-variant-numeric: tabular-nums;
}
.scorebox--w b { background: var(--win); }
.scorebox--l b { background: var(--loss); }
.scorebox--t b { background: var(--tie); }
@media (min-width: 640px) {
  .sched { grid-template-columns: 168px minmax(0, 1fr) auto; align-items: center; }
  .sched__when { grid-column: 1; flex-direction: column; gap: 0; align-items: flex-start; }
  .sched__main { grid-column: 2; }
  .sched__score { grid-column: 3; grid-row: 1; }
}
</style>
