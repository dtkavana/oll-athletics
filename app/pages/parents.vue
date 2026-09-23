<script setup lang="ts">
import {
  formatDate, formatTime, parishEvents, parentSportSeasons, parentSeasonActive, parentSeasonFinished,
  type ParishEvent
} from '~/composables/useSnapshot'

useHead({ title: 'Parents' })

const seasons = computed(() => parentSportSeasons())

const parishGroups = computed(() => {
  const groups: { sport: string; note: string; events: ParishEvent[] }[] = []
  for (const event of parishEvents) {
    let group = groups.find(g => g.sport === event.sport)
    if (!group) {
      group = { sport: event.sport, note: event.note ?? '', events: [] }
      groups.push(group)
    } else if (event.note && event.note !== group.note) {
      group.note = ''
    }
    group.events.push(event)
  }
  return groups
})
function parishAnchor (sport: string) {
  const group = parishGroups.value.find(g => g.sport === sport)
  if (!group) return null
  const id = 'parish-' + sport.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const label = group.events.every(e => /evaluation/i.test(e.title)) ? 'Evaluations' : 'Details'
  return { id, label }
}

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
            <td class="seasons__sport">
              {{ row.sport }}
              <a
                v-if="parishAnchor(row.sport)"
                class="seasons__below"
                :href="`#${parishAnchor(row.sport)!.id}`"
              >{{ parishAnchor(row.sport)!.label }} ↓</a>
            </td>
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

    <section
      v-for="group in parishGroups"
      :id="parishAnchor(group.sport)!.id"
      :key="group.sport"
      class="parish"
    >
      <article class="card parish__card">
        <h2>{{ group.sport }}</h2>
        <p v-if="group.note" class="parish__note">{{ group.note }}</p>
        <ul class="parish__list">
          <li v-for="event in group.events" :key="event.date + event.title">
            <span class="parish__date">{{ formatDate(event.date, { weekday: 'short', month: 'short', day: 'numeric' }) }}</span>
            <span class="parish__detail">
              <span class="parish__title">{{ event.title }}</span>
              <span v-if="event.startTime" class="parish__when">
                {{ formatTime(event.startTime) }}<template v-if="event.endTime">&ndash;{{ formatTime(event.endTime) }}</template>
              </span>
              <span v-if="event.venue" class="parish__where">{{ event.venue }}</span>
              <span v-if="!group.note && event.note" class="parish__event-note">{{ event.note }}</span>
            </span>
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 58ch; }
.register-note { margin: 0 0 22px; max-width: 58ch; }
.assist-note { margin: 16px 0 0; max-width: 58ch; }
.lead a,
.register-note a,
.assist-note a { color: var(--gold-deep); text-decoration: underline; text-underline-offset: 2px; }
.lead a:hover,
.register-note a:hover,
.assist-note a:hover { color: var(--navy); }
@media (prefers-color-scheme: dark) {
  .lead a,
  .register-note a,
  .assist-note a { color: var(--gold); }
  .lead a:hover,
  .register-note a:hover,
  .assist-note a:hover { color: var(--gold-bright); }
}
.seasons__sport { font-weight: 600; }
.seasons__below {
  display: block; margin-top: 3px;
  font-family: var(--font-cond); font-size: .78rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: underline;
  text-underline-offset: 2px; color: var(--gold-deep);
}
.seasons__below:hover { color: var(--navy); }
@media (prefers-color-scheme: dark) {
  .seasons__below { color: var(--gold); }
  .seasons__below:hover { color: var(--gold-bright); }
}
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

.parish { margin-top: 28px; scroll-margin-top: 16px; }
.parish h2 { margin: 0 0 8px; font-size: 1.05rem; }
.parish__card { padding: 14px 16px; }
.parish__card + .parish__card { margin-top: 12px; }
.parish__note { margin: 0 0 12px; max-width: 62ch; }
.parish__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.parish__list li {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr);
  gap: 10px 14px;
  align-items: baseline;
}
.parish__date { font-weight: 600; }
.parish__detail { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.parish__title { font-weight: 600; }
.parish__when, .parish__where { color: var(--muted); }
.parish__event-note { flex-basis: 100%; color: var(--muted); }
@media (max-width: 520px) {
  .parish__list li { grid-template-columns: 1fr; gap: 2px; }
}
</style>
