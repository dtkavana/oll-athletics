<script setup lang="ts">
import { data, teamRecord, activeSeasons, byLeague, isRetired, sportOf, sportVar, teamLabel, formatDate } from '~/composables/useSnapshot'

useHead({ title: 'Teams' })

const order = activeSeasons()
const grouped = computed(() =>
  order.map(({ season, active, window }) => ({
    season,
    active,
    window,
    teams: data.teams.filter(t => t.season === season).slice().sort(byLeague)
  })).filter(g => g.teams.length))

const range = (w: { start: string; end: string } | null) =>
  w ? `${formatDate(w.start)} – ${formatDate(w.end)}` : null
</script>

<template>
  <div>
    <div class="section__head"><h1>Teams</h1></div>
    <p class="muted small lead">
      Every Lourdes and East Side Crusaders team registered with CYO.
    </p>

    <section v-for="g in grouped" :key="g.season" class="section">
      <div class="section__head">
        <h2 :style="{ '--accent': `var(${sportVar(sportOf(g.season))})` }">
          <span class="dot" />{{ g.season }}
        </h2>
        <span v-if="g.active" class="pill pill--gold">In season</span>
        <span v-else-if="isRetired(g.season)" class="pill" title="CYO no longer publishes this season">Archived</span>
        <span v-if="range(g.window)" class="dates">{{ range(g.window) }}</span>
      </div>

      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th><th>League</th><th>Div</th>
              <th class="num">League</th><th>Coach</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in g.teams" :key="t.id">
              <td><NuxtLink class="teamlink" :to="`/teams/${t.id}`">{{ teamLabel(t) }}</NuxtLink></td>
              <td>{{ t.league }}</td>
              <td>{{ t.division }}</td>
              <td class="num">
                <template v-if="teamRecord(t).w + teamRecord(t).l + teamRecord(t).t">
                  {{ teamRecord(t).w }}&ndash;{{ teamRecord(t).l }}<template v-if="teamRecord(t).t">&ndash;{{ teamRecord(t).t }}</template>
                </template>
                <span v-else class="muted">&mdash;</span>
              </td>
              <td class="muted small">{{ t.coaches.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 22px; max-width: 62ch; }
h2 { display: flex; align-items: center; gap: 9px; }
.dot { width: 13px; height: 13px; border-radius: 2px; background: var(--accent); flex: none; }
.dates {
  font-family: var(--font-cond); font-size: .92rem; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
  margin-left: auto;
}
.teamlink {
  display: block; padding: 6px 0; min-height: 34px;
  font-family: var(--font-display); font-size: 1.05rem;
  text-transform: uppercase; text-decoration: none; color: var(--navy);
}
.teamlink:hover { text-decoration: underline; text-decoration-color: var(--gold); text-decoration-thickness: 3px; }
@media (prefers-color-scheme: dark) { .teamlink { color: var(--gold); } }
</style>
