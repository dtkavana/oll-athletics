<script setup lang="ts">
import {
  type Game, isOurs, formatDate, formatTime, outcome,
  sportOf, sportVar, matchup, displayTeam, sides
} from '~/composables/useSnapshot'

// Vue casts an absent Boolean prop to false, so showDate needs an explicit
// default or every list would silently drop its dates.
const props = withDefaults(defineProps<{
  game: Game
  /** When set, the row is written from this team's point of view. */
  perspective?: string
  showDate?: boolean
}>(), { perspective: undefined, showDate: true })

const result = computed(() => outcome(props.game, viewpoint.value))
const played = computed(() => props.game.status === 'Played')
// Only Lourdes has an identifiable home venue in CYO's data; East Side
// Crusaders is a co-op that plays at borrowed fields, so no badge for them.
const m = computed(() => matchup(props.game))

// Default to our own side, so every list (scores, home, team pages) shows the
// result as W/L rather than a neutral final score. An explicit perspective
// still wins, which matters on a team page for a game between two of our teams.
const viewpoint = computed(() => props.perspective ?? sides(props.game).ours.name)
</script>

<template>
  <li class="row" :style="{ '--accent': `var(${sportVar(sportOf(game.season))})` }">
    <div class="row__when">
      <span v-if="showDate" class="row__date">{{ formatDate(game.date) }}</span>
      <span class="row__time">{{ formatTime(game.startTime) }}</span>
    </div>

    <div class="row__teams">
      <p class="row__matchup">
        <span :class="{ ours: isOurs(m.first.name) }">{{ displayTeam(m.first.name, game.season, game.league) }}</span>
        <span class="vs" :class="{ 'vs--at': m.at }">{{ m.sep }}</span>
        <span :class="{ ours: isOurs(m.second.name) }">{{ displayTeam(m.second.name, game.season, game.league) }}</span>
      </p>
      <p class="row__meta">
        <span class="row__sport">{{ sportOf(game.season) }}</span>
        <span v-if="game.tournament" class="row__tourney">
          &#127942; Tournament<template v-if="game.tournament.round"> R{{ game.tournament.round }}</template>
        </span>
        <span>{{ game.league }}<template v-if="game.division"> · Div {{ game.division }}</template></span>
        <span v-if="game.venue">{{ game.venue }}</span>
      </p>
    </div>

    <div class="row__score">
      <template v-if="played">
        <span v-if="result" class="scorebox" :class="`scorebox--${result.result.toLowerCase()}`">
          <b>{{ result.result }}</b>
          <span class="scorebox__n">{{ result.us }}&ndash;{{ result.them }}</span>
        </span>
        <span v-else class="scorebox scorebox--final">
          <b>F</b><span class="scorebox__n">{{ game.team1.score }}&ndash;{{ game.team2.score }}</span>
        </span>
      </template>
      <!-- The time already sits in the left column; use this slot for the one
           thing a schedule does not otherwise say at a glance. -->
      <span v-else-if="m.home" class="homebadge">Home</span>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 14px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid var(--border);
  list-style: none;
  position: relative;
}
/* Sport stripe down the left edge — the only place sport colour appears here. */
.row::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 5px; background: var(--accent);
}
.row:last-child { border-bottom: 0; }

.row__when { grid-column: 1; display: flex; gap: 8px; align-items: baseline; }
.row__date {
  font-family: var(--font-cond); font-weight: 600; font-size: .95rem;
  letter-spacing: .06em; text-transform: uppercase;
}
.row__time { font-family: var(--font-cond); font-size: .92rem; color: var(--muted); }

.row__teams { grid-column: 1; min-width: 0; }
.row__matchup {
  margin: 0; font-family: var(--font-display); font-size: 1.1rem;
  text-transform: uppercase; line-height: 1.15; overflow-wrap: anywhere;
}
.vs { color: var(--muted); font-family: var(--font-cond); font-size: .8rem; margin: 0 5px; }
/* "@" carries meaning (road game), so it gets weight the neutral "vs" does not. */
.vs--at { color: var(--navy); font-weight: 700; font-size: .95rem; }
@media (prefers-color-scheme: dark) { .vs--at { color: var(--gold); } }
.ours { color: var(--navy); }
@media (prefers-color-scheme: dark) { .ours { color: var(--gold); } }

.row__meta {
  margin: 3px 0 0; display: flex; flex-wrap: wrap; gap: 4px 10px;
  font-family: var(--font-cond); font-size: .88rem; color: var(--muted);
  letter-spacing: .04em;
}
.row__sport {
  color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: .1em;
}
.row__tourney { color: var(--gold-deep); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
@media (prefers-color-scheme: dark) { .row__tourney { color: var(--gold); } }
.row__home { font-weight: 600; color: var(--text); }

.row__score { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; }

/* Scoreboard chip: letter grade + tabular score, like a gym board. */
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
.scorebox--final b { background: var(--muted); }

.homebadge {
  display: inline-block; padding: 4px 9px; border-radius: 3px;
  background: var(--gold); color: var(--navy);
  font-family: var(--font-cond); font-weight: 600; font-size: .82rem;
  letter-spacing: .12em; text-transform: uppercase;
}

@media (min-width: 640px) {
  .row { grid-template-columns: 132px minmax(0, 1fr) auto; align-items: center; }
  .row__when { grid-column: 1; flex-direction: column; gap: 0; align-items: flex-start; }
  .row__teams { grid-column: 2; }
  .row__score { grid-column: 3; grid-row: 1; }
}
</style>
