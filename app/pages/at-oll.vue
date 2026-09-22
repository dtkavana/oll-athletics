<script setup lang="ts">
import {
  data, TODAY, formatDate, formatTime,
  isCampusHomeGame, campusVenueLabel, sportOf, sportVar, matchup, displayTeam
} from '~/composables/useSnapshot'

useHead({ title: '@ OLL' })

const homeUpcoming = computed(() =>
  data.games
    .filter(g => g.date >= TODAY && g.status !== 'Played' && isCampusHomeGame(g))
    .sort((a, b) =>
      a.date.localeCompare(b.date)
      || (a.startTime ?? '').localeCompare(b.startTime ?? '')))

const homeByDate = computed(() => {
  const m = new Map<string, typeof homeUpcoming.value>()
  for (const g of homeUpcoming.value) {
    if (!m.has(g.date)) m.set(g.date, [])
    m.get(g.date)!.push(g)
  }
  return [...m.entries()]
})
</script>

<template>
  <div>
    <div class="section__head">
      <h1>@ OLL</h1>
    </div>
    <p class="muted small lead">
      Home games at Lourdes or Scecina &mdash; listed top to bottom by date.
    </p>

    <ol v-if="homeByDate.length" class="homeline card">
      <li
        v-for="([date, games], i) in homeByDate"
        :key="date"
        class="homeline__day"
        :class="{ 'homeline__day--today': date === TODAY, 'homeline__day--last': i === homeByDate.length - 1 }"
      >
        <div class="homeline__rail" aria-hidden="true"><span class="homeline__dot" /></div>
        <div class="homeline__stamp">
          <span class="homeline__dow">{{ formatDate(date, { weekday: 'short' }) }}</span>
          <span class="homeline__ymd">{{ formatDate(date, { month: 'short', day: 'numeric' }) }}</span>
        </div>
        <ul class="homeline__games">
          <li
            v-for="g in games"
            :key="g.id"
            class="homegame"
            :style="{ '--accent': `var(${sportVar(sportOf(g.season))})` }"
          >
            <p class="homegame__time">{{ g.startTime ? formatTime(g.startTime) : 'TBD' }}</p>
            <p class="homegame__match">
              <span class="ours">{{ displayTeam(matchup(g).first.name, g.season, g.league) }}</span>
              <span class="homegame__vs">vs</span>
              <span>{{ displayTeam(matchup(g).second.name, g.season, g.league) }}</span>
            </p>
            <p class="homegame__meta">
              <span class="homegame__sport">{{ sportOf(g.season) }}</span>
              <span>{{ campusVenueLabel(g.venue) }}</span>
              <span v-if="g.league">{{ g.league }}</span>
            </p>
          </li>
        </ul>
      </li>
    </ol>
    <p v-else class="card empty">No home games scheduled at Lourdes or Scecina</p>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 52ch; }
.homeline {
  list-style: none; margin: 0; padding: 16px 16px 8px 0;
}
.homeline__day {
  display: grid;
  grid-template-columns: 20px 88px minmax(0, 1fr);
  gap: 0 14px;
  padding-bottom: 18px;
  position: relative;
}
.homeline__day--last { padding-bottom: 4px; }
.homeline__rail {
  display: flex; justify-content: center;
  position: relative;
}
.homeline__rail::before {
  content: ''; position: absolute; top: 10px; bottom: -18px; left: 50%;
  width: 2px; margin-left: -1px; background: var(--border);
}
.homeline__day--last .homeline__rail::before { display: none; }
.homeline__dot {
  width: 12px; height: 12px; margin-top: 4px; border-radius: 50%;
  background: var(--navy); border: 2px solid var(--gold); flex: none; z-index: 1;
}
.homeline__day--today .homeline__dot { background: var(--gold); border-color: var(--navy); }
.homeline__stamp {
  padding-top: 2px;
  font-family: var(--font-cond); text-transform: uppercase; letter-spacing: .08em;
}
.homeline__dow {
  display: block; font-weight: 600; font-size: .78rem; color: var(--muted);
}
.homeline__ymd {
  display: block; font-family: var(--font-display); font-size: 1.15rem; line-height: 1.05;
}
.homeline__day--today .homeline__ymd { color: var(--navy); }
@media (prefers-color-scheme: dark) { .homeline__day--today .homeline__ymd { color: var(--gold); } }
.homeline__games { margin: 0; padding: 0; list-style: none; }
.homegame {
  padding: 10px 12px 12px 10px;
  border-bottom: 1px solid var(--border);
  border-left: 4px solid var(--accent, var(--navy));
}
.homegame:last-child { border-bottom: 0; }
.homegame__time {
  margin: 0 0 4px; font-family: var(--font-cond); font-weight: 600;
  font-size: .92rem; letter-spacing: .06em; color: var(--muted);
}
.homegame__match {
  margin: 0; font-family: var(--font-display); font-size: 1.05rem;
  text-transform: uppercase; line-height: 1.15;
}
.homegame__vs {
  margin: 0 5px; font-family: var(--font-cond); font-size: .78rem;
  color: var(--muted); font-weight: 600;
}
.homegame__meta {
  margin: 5px 0 0; display: flex; flex-wrap: wrap; gap: 4px 12px;
  font-family: var(--font-cond); font-size: .86rem; color: var(--muted);
}
.homegame__sport {
  color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
}
.ours { color: var(--navy); }
@media (prefers-color-scheme: dark) { .ours { color: var(--gold); } }
</style>
