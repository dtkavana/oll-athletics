<script setup lang="ts">
import { data, isOurs, activeSeasons, byLeague, sportOf, sportVar, displayTeam } from '~/composables/useSnapshot'

useHead({ title: 'Standings' })

const seasons = activeSeasons().map(s => s.season)
const season = ref(seasons[0] ?? '')
const showAllDivisions = ref(false)

watch(season, () => { showAllDivisions.value = false })

const tables = computed(() =>
  data.standings.filter(s => s.season === season.value).slice().sort(byLeague))

/** Split a league table into its divisions, preserving CYO's ordering. */
function divisions (rows: typeof data.standings[number]['rows']) {
  const m = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = r.division ?? ''
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  return [...m]
}

function oursDivisions (rows: typeof data.standings[number]['rows']) {
  return divisions(rows).filter(([, rs]) => rs.some(r => isOurs(r.team)))
}

function visibleDivisions (rows: typeof data.standings[number]['rows']) {
  if (showAllDivisions.value) return divisions(rows)
  const ours = oursDivisions(rows)
  return ours.length ? ours : divisions(rows)
}

const extraDivisionCount = computed(() =>
  tables.value.reduce((n, t) => {
    const ours = oursDivisions(t.rows)
    if (!ours.length) return n
    return n + divisions(t.rows).length - ours.length
  }, 0))
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Standings</h1>
      <select v-model="season" aria-label="Season">
        <option v-for="s in seasons" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <p class="muted small lead">
      <span class="key"><i /> Lourdes &amp; East Side</span>
      <label v-if="extraDivisionCount || showAllDivisions" class="check">
        <input v-model="showAllDivisions" type="checkbox">
        Show all divisions
      </label>
    </p>

    <section
      v-for="t in tables" :key="t.league" class="section"
      :style="{ '--accent': `var(${sportVar(sportOf(t.season))})` }"
    >
      <div class="section__head"><h2><span class="dot" />{{ t.league }}</h2></div>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr><th class="rank">#</th><th>Team</th><th class="num">W</th><th class="num">L</th><th class="num">T</th></tr>
          </thead>
          <tbody>
            <template v-for="[div, rows] in visibleDivisions(t.rows)" :key="div">
              <tr v-if="div" class="divider"><td colspan="5">Division {{ div }}</td></tr>
              <tr v-for="(r, i) in rows" :key="div + r.team" :class="{ 'is-ours': isOurs(r.team) }">
                <td class="rank">{{ i + 1 }}</td>
                <td>{{ displayTeam(r.team, t.season, t.league) }}</td>
                <td class="num">{{ r.wins }}</td>
                <td class="num">{{ r.losses }}</td>
                <td class="num">{{ r.draws }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <p v-if="!tables.length" class="card empty">No standings published for this season yet</p>
  </div>
</template>

<style scoped>
.lead {
  margin: 0 0 22px; display: flex; gap: 10px 16px;
  align-items: center; justify-content: space-between; flex-wrap: wrap;
}
.key { display: inline-flex; align-items: center; gap: 6px; }
.check {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-family: var(--font-cond); font-weight: 600; font-size: .84rem;
  letter-spacing: .06em; text-transform: uppercase; color: var(--text);
}
.check input {
  appearance: none; width: 16px; height: 16px; margin: 0; flex: none;
  border: 2px solid var(--navy); border-radius: 3px; background: var(--surface);
  cursor: pointer;
}
.check input:checked {
  background: var(--gold); border-color: var(--gold);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23002B5C' stroke-width='2.4' stroke-linecap='square' d='M3.5 8.2 6.6 11.2 12.5 4.8'/%3E%3C/svg%3E");
}
.check input:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .check input { border-color: var(--border); }
}
.key i { width: 14px; height: 14px; border-radius: 2px; background: color-mix(in srgb, var(--gold) 45%, transparent); box-shadow: inset 3px 0 0 var(--gold); }
h2 { display: flex; align-items: center; gap: 9px; }
.dot { width: 13px; height: 13px; border-radius: 2px; background: var(--accent); flex: none; }
td.rank, th.rank {
  width: 1%; text-align: center; color: var(--muted);
  font-family: var(--font-cond); font-variant-numeric: tabular-nums;
}
</style>
