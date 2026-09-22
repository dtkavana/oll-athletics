<script setup lang="ts">
import {
  formatDate, parentSportSeasons, parentSeasonActive, parentSeasonFinished
} from '~/composables/useSnapshot'

useHead({ title: 'Parents' })

const seasons = computed(() => parentSportSeasons())
const yearLabel = computed(() => {
  const first = seasons.value[0]?.start
  if (!first) return 'CYO sport calendar'
  const y = Number(first.slice(0, 4))
  return `${y}–${y + 1} school year`
})
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Parents</h1>
    </div>
    <p class="muted small lead">
      CYO estimated sport start and finish dates for {{ yearLabel }}.
      Listed start dates are when games are expected to begin; practices usually start a few weeks earlier.
    </p>

    <p class="muted small register-note">
      <a href="https://fm.orgsonline.com/m_login.aspx" target="_blank" rel="noopener noreferrer">
        Register for sports on Orgs Online ↗
      </a>.
      Baseball and football register under Holy Spirit; track &amp; field registers under Little Flower.
    </p>

    <div class="card table-wrap">
      <table class="seasons">
        <thead>
          <tr>
            <th>Sport</th>
            <th>Est. cost</th>
            <th>Games start</th>
            <th>Finishes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in seasons" :key="row.sport + row.start">
            <td class="seasons__sport">{{ row.sport }}</td>
            <td class="seasons__cost">{{ row.costEstimate }}</td>
            <td>{{ formatDate(row.start, { weekday: 'short', month: 'short', day: 'numeric' }) }}</td>
            <td>
              {{ formatDate(row.end, { weekday: 'short', month: 'short', day: 'numeric' }) }}
              <span v-if="row.endEstimated" class="est" title="Estimated — CYO calendar has no published end date">est.</span>
            </td>
            <td class="seasons__status">
              <span v-if="parentSeasonActive(row)" class="pill pill--gold">In season</span>
              <span v-else-if="parentSeasonFinished(row)" class="pill pill--finished">Finished</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="muted small assist-note">
      For financial assistance options, contact Eileen Barada at
      <a href="mailto:businessmanager@ollindy.org">businessmanager@ollindy.org</a>.
    </p>

    <p v-if="!seasons.length" class="card empty">No sport dates loaded from the CYO calendar.</p>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 58ch; }
.register-note { margin: 0 0 22px; max-width: 58ch; }
.assist-note { margin: 16px 0 0; max-width: 58ch; }
.lead a,
.register-note a,
.assist-note a { color: var(--gold-deep); text-decoration: underline; text-underline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .lead a,
  .register-note a,
  .assist-note a { color: var(--gold); }
}
.seasons__sport { font-weight: 600; }
.seasons__cost { min-width: 5rem; white-space: nowrap; }
.seasons__status { text-align: right; white-space: nowrap; }
.pill--finished { background: var(--loss); color: #fff; }
.est {
  margin-left: 5px;
  font-family: var(--font-cond);
  font-size: .78rem;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
}
.lead .est { margin-left: 0; }
</style>
