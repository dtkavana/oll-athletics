<script setup lang="ts">
import {
  data, TODAY, formatDate, formatTime, parishEvents, sportEvents, sportOf
} from '~/composables/useSnapshot'
import type { SliderAnnouncement } from '~/components/NextUpSlider.vue'

useHead({ title: 'Home' })

const upcoming = computed(() =>
  data.games.filter(g => g.date >= TODAY && g.status !== 'Played'))

/** The next few fixtures rotate through the banner. */
const featured = computed(() => upcoming.value.slice(0, 5))

/** Parish dates still ahead, led as the first carousel slide. */
const announcement = computed((): SliderAnnouncement | null => {
  const events = parishEvents.filter(e => e.date >= TODAY)
  if (!events.length) return null
  const byDate = new Map<string, typeof events>()
  for (const event of events) {
    const list = byDate.get(event.date) ?? []
    list.push(event)
    byDate.set(event.date, list)
  }
  const sport = events[0]!.sport
  const evaluations = events.every(e => /evaluation/i.test(e.title))
  return {
    sport,
    title: evaluations ? 'Evaluations' : sport,
    note: events.find(e => e.note)?.note ?? null,
    dates: [...byDate.entries()].map(([date, items]) => ({
      date,
      venue: items.find(item => item.venue)?.venue ?? null,
      items: items.map(item => ({
        label: item.title
          .replace(/^Boys Basketball\s+/i, '')
          .replace(/\s+Evaluations$/i, ''),
        time: item.startTime
          ? `${formatTime(item.startTime)}${item.endTime ? `–${formatTime(item.endTime)}` : ''}`
          : ''
      }))
    }))
  }
})

const byDate = computed(() => {
  const m = new Map<string, typeof upcoming.value>()
  for (const g of upcoming.value.slice(0, 12)) {
    if (!m.has(g.date)) m.set(g.date, [])
    m.get(g.date)!.push(g)
  }
  return [...m]
})

const recent = computed(() => data.games.filter(g => g.status === 'Played').slice(-6).reverse())
const events = computed(() => sportEvents.filter(e => e.date >= TODAY).slice(0, 5))

/** Teams that still have a game on the schedule. */
const teamsInSeason = computed(() => {
  const live = new Set(data.games.filter(g => g.date >= TODAY).flatMap(g => g.teamIds))
  return data.teams.filter(team => live.has(team.id)).length
})

/** Sports that still have a game on the schedule. */
const activeSports = computed(() => {
  const live = new Set(upcoming.value.flatMap(g => g.teamIds))
  return new Set(
    data.teams.filter(team => live.has(team.id)).map(team => sportOf(team.season))
  ).size
})
</script>

<template>
  <div>
    <NextUpSlider :games="featured" :announcement="announcement" />

    <!-- ── Scoreboard strip ── -->
    <section class="strip">
      <div class="strip__cell">
        <span class="strip__n">{{ teamsInSeason }}</span>
        <span class="strip__l">Teams in season</span>
      </div>
      <div class="strip__cell">
        <span class="strip__n">{{ activeSports }}</span>
        <span class="strip__l">Active sports</span>
      </div>
      <div class="strip__cell">
        <span class="strip__n">{{ upcoming.length }}</span>
        <span class="strip__l">Games remaining</span>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2>Latest results</h2>
        <NuxtLink to="/scores">All scores &rarr;</NuxtLink>
      </div>
      <GameList :games="recent" empty="No games played yet" />
    </section>

    <section class="section">
      <div class="section__head">
        <h2>Coming up</h2>
        <NuxtLink to="/calendar">Full calendar &rarr;</NuxtLink>
      </div>
      <div v-if="byDate.length" class="card">
        <template v-for="[date, games] in byDate" :key="date">
          <p class="daybar" :class="{ 'daybar--today': date === TODAY }">
            <span>{{ formatDate(date, { weekday: 'long' }) }}</span>
            <span>{{ games.length }} game<template v-if="games.length !== 1">s</template></span>
          </p>
          <ul class="list">
            <GameRow v-for="g in games" :key="g.id" :game="g" :show-date="false" show-home />
          </ul>
        </template>
      </div>
      <p v-else class="card empty">No games on the CYO schedule right now</p>
    </section>

    <section class="section">
      <div class="section__head"><h2>CYO sport dates</h2></div>
      <div class="card">
        <ul v-if="events.length" class="list">
          <li v-for="e in events" :key="e.date + e.title" class="ev">
            <span class="ev__date">{{ formatDate(e.date) }}</span>
            <span>{{ e.title }}</span>
          </li>
        </ul>
        <p v-else class="empty">Nothing scheduled</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.list { margin: 0; padding: 0; list-style: none; }

/* ---- stat strip ---- */
.strip {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
  background: var(--navy); border-radius: var(--radius);
  overflow: hidden; margin-bottom: 30px;
}
.strip__cell { background: var(--navy); padding: 12px 14px; text-align: center; }
.strip__n {
  display: block; font-family: var(--font-display); font-size: clamp(1.5rem, 4vw, 2.1rem);
  color: var(--gold); line-height: 1; font-variant-numeric: tabular-nums;
}
.strip__n i { font-style: normal; opacity: .55; }
.strip__l {
  display: block; margin-top: 4px; font-family: var(--font-cond);
  font-size: .78rem; letter-spacing: .12em; text-transform: uppercase; color: #9FB6D6;
}

/* ---- CYO dates ---- */
.ev {
  display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 12px;
  padding: 11px 14px; border-bottom: 1px solid var(--border); align-items: baseline;
}
.ev:last-child { border-bottom: 0; }
.ev__date {
  font-family: var(--font-cond); font-weight: 600; font-size: .92rem;
  letter-spacing: .06em; text-transform: uppercase; color: var(--gold-deep); white-space: nowrap;
}
@media (prefers-color-scheme: dark) { .ev__date { color: var(--gold); } }
</style>
