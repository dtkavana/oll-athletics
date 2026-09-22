<script setup lang="ts">
import { data, teamById, teamGames, teamRecord, TODAY, isOurs, sportOf, sportVar, teamLabel, displayTeam } from '~/composables/useSnapshot'

const route = useRoute()
const team = computed(() => teamById.get(String(route.params.id)))

if (!team.value) throw createError({ statusCode: 404, statusMessage: 'Team not found', fatal: true })

useHead(() => ({ title: `${teamLabel(team.value!)} · ${team.value!.league}` }))

const games = computed(() => teamGames(team.value!))
const results = computed(() => games.value.filter(g => g.status === 'Played'))
const fixtures = computed(() => games.value.filter(g => g.status !== 'Played' && g.date >= TODAY))
const record = computed(() => teamRecord(team.value!))
const tourneyRecord = computed(() => teamRecord(team.value!, 'tournament'))
const playedTournament = computed(() => {
  const r = tourneyRecord.value
  return r.w + r.l + r.t > 0
})

/** Standings for this team's league, narrowed to its own division. */
const standings = computed(() => {
  const table = data.standings.find(s => s.season === team.value!.season && s.league === team.value!.league)
  if (!table) return []
  const mine = table.rows.filter(r => r.division === team.value!.division)
  return mine.length ? mine : table.rows
})

const icsUrl = computed(() => `/ics/${team.value!.id}.ics`)
</script>

<template>
  <div v-if="team" :style="{ '--accent': `var(${sportVar(sportOf(team.season))})` }">
    <NuxtLink to="/teams" class="back">&larr; All teams</NuxtLink>

    <!-- Team banner: the jersey, basically. -->
    <header class="banner">
      <img class="banner__lion" src="/brand/lion-gold.png" alt="" width="84" height="84">
      <div class="banner__id">
        <p class="banner__sport">{{ sportOf(team.season) }} &middot; {{ team.season }}</p>
        <h1>{{ teamLabel(team) }}</h1>
        <p class="banner__league">
          {{ team.league }} &middot; Division {{ team.division }}
          <template v-if="team.coaches.length"> &middot; Coach {{ team.coaches.join(', ') }}</template>
        </p>
      </div>
      <div class="banner__rec">
        <span class="banner__wl">{{ record.w }}<i>&ndash;</i>{{ record.l }}<template v-if="record.t"><i>&ndash;</i>{{ record.t }}</template></span>
        <span class="banner__lbl">League record</span>
        <span v-if="playedTournament" class="banner__tourney">
          &#127942; {{ tourneyRecord.w }}&ndash;{{ tourneyRecord.l }} tournament
        </span>
      </div>
    </header>

    <p class="topline">
      <a class="btn btn--primary" :href="icsUrl">&#128197; Add to calendar</a>
    </p>

    <section v-if="fixtures.length" class="section">
      <div class="section__head"><h2>Upcoming</h2></div>
      <GameList :games="fixtures" :perspective="team.name" />
    </section>

    <section class="section">
      <div class="section__head"><h2>Results</h2></div>
      <GameList :games="[...results].reverse()" :perspective="team.name" empty="No games played yet." />
    </section>

    <section v-if="standings.length" class="section">
      <div class="section__head">
        <h2>{{ team.league }} &middot; Division {{ team.division }}</h2>
        <NuxtLink to="/standings">All standings &rarr;</NuxtLink>
      </div>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr><th>Team</th><th class="num">W</th><th class="num">L</th><th class="num">T</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in standings" :key="r.team" :class="{ 'is-ours': isOurs(r.team) }">
              <td>{{ displayTeam(r.team, team.season, team.league) }}</td>
              <td class="num">{{ r.wins }}</td>
              <td class="num">{{ r.losses }}</td>
              <td class="num">{{ r.draws }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.back {
  display: inline-block; margin-bottom: 8px; padding: 10px 2px;
  font-family: var(--font-cond); font-weight: 600; font-size: .92rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--muted); text-decoration: none;
}
.back:hover { color: var(--navy); }

.banner {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  background: linear-gradient(150deg, var(--navy) 0%, var(--navy-deep) 100%);
  color: #fff; padding: 18px 22px; border-radius: var(--radius);
  border-left: 8px solid var(--accent);
}
.banner__lion { flex: none; }
.banner__id { flex: 1 1 260px; min-width: 0; }
.banner__sport {
  margin: 0; font-family: var(--font-cond); font-size: .82rem;
  letter-spacing: .16em; text-transform: uppercase; color: var(--gold);
}
.banner h1 { color: #fff; margin: 2px 0 4px; }
.banner__league { margin: 0; font-size: .92rem; color: #9FB6D6; }

.banner__rec { text-align: right; flex: none; }
.banner__wl {
  display: block; font-family: var(--font-display); line-height: 1;
  font-size: clamp(2rem, 6vw, 2.8rem); color: var(--gold); font-variant-numeric: tabular-nums;
}
.banner__wl i { font-style: normal; opacity: .5; }
.banner__lbl {
  display: block; margin-top: 3px; font-family: var(--font-cond);
  font-size: .76rem; letter-spacing: .14em; text-transform: uppercase; color: #9FB6D6;
}
.banner__tourney {
  display: block; margin-top: 6px; font-family: var(--font-cond);
  font-size: .84rem; letter-spacing: .06em; text-transform: uppercase; color: #fff;
}

.topline { display: flex; gap: 12px; align-items: center; margin: 16px 0 24px; flex-wrap: wrap; }

@media (max-width: 560px) { .banner__rec { text-align: left; } }
</style>
