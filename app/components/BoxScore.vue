<script setup lang="ts">
import { shotPct, formatPm, toSec, formatMin, type PlayerLine, type SeasonLine } from '~/composables/useBoxScore'

const props = defineProps<{
  mode: 'game' | 'season'
  players: PlayerLine[] | SeasonLine[]
}>()

const rows = computed(() => props.players as SeasonLine[])

const totals = computed(() => {
  const sec = props.players.reduce((sum, p) => sum + toSec(p.min), 0)
  const add = (key: keyof PlayerLine) => props.players.reduce((sum, p) => sum + Number(p[key] || 0), 0)
  return {
    min: formatMin(sec),
    pts: add('pts'),
    reb: add('reb'),
    ast: add('ast'),
    pf: add('pf'),
    fgm: add('fgm'),
    fga: add('fga'),
    tpm: add('tpm'),
    tpa: add('tpa'),
    ftm: add('ftm'),
    fta: add('fta'),
    oreb: add('oreb'),
    dreb: add('dreb'),
    stl: add('stl'),
    blk: add('blk'),
    to: add('to')
  }
})

function gsText (row: SeasonLine) {
  if (props.mode === 'season') return String(row.starts)
  return row.gs ? 'Y' : 'N'
}
</script>

<template>
  <div class="card table-wrap">
    <table class="box">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Name</th>
          <th v-if="mode === 'season'" class="num">GP</th>
          <th class="num">GS</th>
          <th class="num">MIN</th>
          <th class="num">PTS</th>
          <th class="num">REB</th>
          <th class="num">AST</th>
          <th class="num">PF</th>
          <th class="num">FG</th>
          <th class="num">FG%</th>
          <th class="num">3P</th>
          <th class="num">3P%</th>
          <th class="num">FT</th>
          <th class="num">FT%</th>
          <th class="num">OREB</th>
          <th class="num">DREB</th>
          <th class="num">STL</th>
          <th class="num">BLK</th>
          <th class="num">TO</th>
          <th class="num">+/-</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.num}-${row.name}`">
          <td class="num">{{ row.num }}</td>
          <td class="name">{{ row.name }}</td>
          <td v-if="mode === 'season'" class="num">{{ row.gp }}</td>
          <td class="num">{{ gsText(row) }}</td>
          <td class="num">{{ row.min }}</td>
          <td class="num">{{ row.pts }}</td>
          <td class="num">{{ row.reb }}</td>
          <td class="num">{{ row.ast }}</td>
          <td class="num">{{ row.pf }}</td>
          <td class="num">{{ row.fgm }}-{{ row.fga }}</td>
          <td class="num">{{ shotPct(row.fgm, row.fga) }}</td>
          <td class="num">{{ row.tpm }}-{{ row.tpa }}</td>
          <td class="num">{{ shotPct(row.tpm, row.tpa) }}</td>
          <td class="num">{{ row.ftm }}-{{ row.fta }}</td>
          <td class="num">{{ shotPct(row.ftm, row.fta) }}</td>
          <td class="num">{{ row.oreb }}</td>
          <td class="num">{{ row.dreb }}</td>
          <td class="num">{{ row.stl }}</td>
          <td class="num">{{ row.blk }}</td>
          <td class="num">{{ row.to }}</td>
          <td class="num">{{ formatPm(row.pm) }}</td>
        </tr>
        <tr class="totals">
          <td class="num" />
          <td class="name">Totals</td>
          <td v-if="mode === 'season'" class="num" />
          <td class="num" />
          <td class="num">{{ totals.min }}</td>
          <td class="num">{{ totals.pts }}</td>
          <td class="num">{{ totals.reb }}</td>
          <td class="num">{{ totals.ast }}</td>
          <td class="num">{{ totals.pf }}</td>
          <td class="num">{{ totals.fgm }}-{{ totals.fga }}</td>
          <td class="num">{{ shotPct(totals.fgm, totals.fga) }}</td>
          <td class="num">{{ totals.tpm }}-{{ totals.tpa }}</td>
          <td class="num">{{ shotPct(totals.tpm, totals.tpa) }}</td>
          <td class="num">{{ totals.ftm }}-{{ totals.fta }}</td>
          <td class="num">{{ shotPct(totals.ftm, totals.fta) }}</td>
          <td class="num">{{ totals.oreb }}</td>
          <td class="num">{{ totals.dreb }}</td>
          <td class="num">{{ totals.stl }}</td>
          <td class="num">{{ totals.blk }}</td>
          <td class="num">{{ totals.to }}</td>
          <td class="num" />
        </tr>
      </tbody>
    </table>
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
