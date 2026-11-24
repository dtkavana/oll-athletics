<script setup lang="ts">
import {
  formatGameScore, toSec,
  type PlayerLine, type SeasonLine
} from '~/composables/useBoxScore'

const props = defineProps<{
  mode: 'game' | 'season'
  players: PlayerLine[] | SeasonLine[]
  teamGames?: number
}>()

const rows = computed(() => props.players as SeasonLine[])
const FT_POSSESSION_FACTOR = 0.44

const totals = computed(() => {
  const add = (key: keyof PlayerLine) =>
    props.players.reduce((sum, player) => sum + Number(player[key] || 0), 0)

  return {
    pts: add('pts'),
    fgm: add('fgm'),
    fga: add('fga'),
    tpm: add('tpm'),
    tpa: add('tpa'),
    ftm: add('ftm'),
    fta: add('fta'),
    to: add('to'),
    oreb: add('oreb'),
    dreb: add('dreb'),
    ast: add('ast'),
    stl: add('stl'),
    blk: add('blk'),
    pf: add('pf')
  }
})

const teamSeconds = computed(() =>
  props.players.reduce((sum, player) => sum + toSec(player.min), 0)
)

function plays (row: Pick<PlayerLine, 'fga' | 'fta' | 'to'>) {
  return row.fga + FT_POSSESSION_FACTOR * row.fta + row.to
}

function pct (numerator: number, denominator: number) {
  if (denominator <= 0) return '—'
  return (100 * numerator / denominator).toFixed(1)
}

function efg (row: Pick<PlayerLine, 'fgm' | 'tpm' | 'fga'>) {
  return pct(row.fgm + 0.5 * row.tpm, row.fga)
}

function ts (row: Pick<PlayerLine, 'pts' | 'fga' | 'fta'>) {
  return pct(row.pts, 2 * (row.fga + FT_POSSESSION_FACTOR * row.fta))
}

function usage (row: PlayerLine) {
  const playerSeconds = toSec(row.min)
  const teamPlays = plays(totals.value)
  if (playerSeconds <= 0 || teamPlays <= 0) return '—'
  return pct(plays(row) * (teamSeconds.value / 5), playerSeconds * teamPlays)
}

function tovPct (row: Pick<PlayerLine, 'fga' | 'fta' | 'to'>) {
  return pct(row.to, plays(row))
}

function astTo (row: Pick<PlayerLine, 'ast' | 'to'>) {
  if (row.to <= 0) return '—'
  return (row.ast / row.to).toFixed(1)
}

function rowGameScore (row: SeasonLine) {
  return formatGameScore(row, props.mode === 'season' ? row.gp : 1)
}

const teamGameScore = computed(() =>
  formatGameScore(totals.value, props.mode === 'season' ? props.teamGames : 1)
)
</script>

<template>
  <div class="card table-wrap">
    <table class="box">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Name</th>
          <th class="num" title="OLL Game Score">GmSc</th>
          <th class="num" title="Effective field-goal percentage">eFG%</th>
          <th class="num" title="True shooting percentage">TS%</th>
          <th class="num" title="Usage percentage">USG%</th>
          <th class="num" title="Turnover percentage">TOV%</th>
          <th class="num" title="Assist-to-turnover ratio">AST/TO</th>
          <th class="num" title="Three-point attempt rate">3PAr</th>
          <th class="num" title="Free-throw rate">FTr</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.num}-${row.name}`">
          <td class="num">{{ row.num }}</td>
          <td class="name">{{ row.name }}</td>
          <td class="num">{{ rowGameScore(row) }}</td>
          <td class="num">{{ efg(row) }}</td>
          <td class="num">{{ ts(row) }}</td>
          <td class="num">{{ usage(row) }}</td>
          <td class="num">{{ tovPct(row) }}</td>
          <td class="num">{{ astTo(row) }}</td>
          <td class="num">{{ pct(row.tpa, row.fga) }}</td>
          <td class="num">{{ pct(row.fta, row.fga) }}</td>
        </tr>
        <tr class="totals">
          <td class="num" />
          <td class="name">Totals</td>
          <td class="num">{{ teamGameScore }}</td>
          <td class="num">{{ efg(totals) }}</td>
          <td class="num">{{ ts(totals) }}</td>
          <td class="num">{{ plays(totals) > 0 ? '100.0' : '—' }}</td>
          <td class="num">{{ tovPct(totals) }}</td>
          <td class="num">{{ astTo(totals) }}</td>
          <td class="num">{{ pct(totals.tpa, totals.fga) }}</td>
          <td class="num">{{ pct(totals.fta, totals.fga) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="stat-notes">
    <p><strong>GmSc</strong> = PTS − .55 FGA − .35 FTA + .15 FTM − .80 TO + .55 OREB + .30 DREB + .50 AST + 1.00 STL + .60 BLK − .30 PF.<template v-if="mode === 'season'"> Season GmSc is per game.</template></p>
    <p><strong>eFG%</strong> weights threes; <strong>TS%</strong> includes free throws; <strong>USG%</strong> is the share of team plays finished while on court; <strong>TOV%</strong> is turnovers per play used; <strong>AST/TO</strong> is assist-to-turnover ratio; <strong>3PAr</strong> and <strong>FTr</strong> are threes and free throws attempted per field-goal attempt.</p>
  </div>
</template>

<style scoped>
.box { font-variant-numeric: tabular-nums; }
.box th, .box td { white-space: nowrap; }
.box .name { font-weight: 600; }
.totals td {
  background: var(--navy);
  color: #fff;
  font-weight: 700;
  border-bottom: 0;
}
.stat-notes {
  margin-top: 8px;
  color: var(--muted);
  font-size: .82rem;
  line-height: 1.45;
}
.stat-notes p { margin: 3px 0; }
.stat-notes strong { color: var(--text); }
@media (max-width: 899px) {
  .box {
    border-collapse: separate;
    border-spacing: 0;
  }
  .box th:first-child,
  .box td:first-child,
  .box th:nth-child(2),
  .box td:nth-child(2) {
    position: sticky;
    z-index: 1;
  }
  .box th:first-child,
  .box td:first-child {
    left: 0;
    width: 2.75rem;
    min-width: 2.75rem;
    max-width: 2.75rem;
    padding-inline: 8px;
  }
  .box th:nth-child(2),
  .box td:nth-child(2) {
    left: 2.75rem;
    box-shadow: 6px 0 8px -6px rgba(0, 27, 60, .45);
  }
  .box thead th:first-child,
  .box thead th:nth-child(2) {
    background: var(--navy);
    z-index: 2;
  }
  .box tbody td:first-child,
  .box tbody td:nth-child(2) {
    background: var(--surface);
  }
  .box .totals td:first-child,
  .box .totals td:nth-child(2) {
    background: var(--navy);
  }
}
@media (prefers-color-scheme: dark) {
  .totals td { background: var(--navy-mid); }
}
@media (max-width: 899px) and (prefers-color-scheme: dark) {
  .box .totals td:first-child,
  .box .totals td:nth-child(2) { background: var(--navy-mid); }
}
</style>
