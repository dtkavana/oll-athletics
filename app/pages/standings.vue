<script setup lang="ts">
import { data, isOurs, activeSeasons, byLeague, sportOf, sportVar, displayTeam } from '~/composables/useSnapshot'

useHead({ title: 'Standings' })

const seasons = activeSeasons().map(s => s.season)
const season = ref(seasons[0] ?? '')

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
      Only the leagues our teams play in. <span class="key"><i /> Lourdes &amp; East Side</span>
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
            <template v-for="[div, rows] in divisions(t.rows)" :key="div">
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
.lead { margin: 0 0 22px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.key { display: inline-flex; align-items: center; gap: 6px; }
.key i { width: 14px; height: 14px; border-radius: 2px; background: color-mix(in srgb, var(--gold) 45%, transparent); box-shadow: inset 3px 0 0 var(--gold); }
h2 { display: flex; align-items: center; gap: 9px; }
.dot { width: 13px; height: 13px; border-radius: 2px; background: var(--accent); flex: none; }
td.rank, th.rank {
  width: 1%; text-align: center; color: var(--muted);
  font-family: var(--font-cond); font-variant-numeric: tabular-nums;
}
</style>
