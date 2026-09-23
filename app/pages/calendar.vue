<script setup lang="ts">
import {
  data, TODAY, formatDate, formatTime,
  sides, resultClass, sportOf, sportVar, sportsForCalendar, videosOn, matchup, displayTeam, teamLabel,
  sportEvents, parishEvents, isCrossCountryEvent, type CalendarEvent, type ParishEvent
} from '~/composables/useSnapshot'

useHead({ title: 'Calendar' })

const SPORTS = sportsForCalendar()

/** Legend entries double as filters, so the key and the toggles cannot drift. */
const shown = ref<Record<string, boolean>>(
  Object.fromEntries(SPORTS.map(s => [s, true]))
)
const showEvents = ref(true)
const showParish = ref(true)
const teamFilter = ref('')

const teamOptions = computed(() =>
  [...new Map(data.teams.filter(t => t.gameIds.length)
    .map(t => [t.id, t])).values()]
    .sort((a, b) => a.season.localeCompare(b.season) || a.name.localeCompare(b.name)))

const months = computed(() => {
  const set = new Set<string>()
  for (const g of data.games) set.add(g.date.slice(0, 7))
  for (const e of sportEvents) set.add(e.date.slice(0, 7))
  for (const e of parishEvents) set.add(e.date.slice(0, 7))
  return [...set].sort()
})
const current = ref(months.value.find(m => m >= TODAY.slice(0, 7)) ?? months.value.at(-1) ?? TODAY.slice(0, 7))

const label = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const visibleGames = computed(() => data.games.filter(g => {
  if (!shown.value[sportOf(g.season)]) return false
  if (teamFilter.value && !g.teamIds.includes(teamFilter.value)) return false
  return true
}))

const weeks = computed(() => {
  const [y, m] = current.value.split('-').map(Number)
  const first = new Date(y!, m! - 1, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  const gamesByDate = new Map<string, typeof data.games>()
  for (const g of visibleGames.value) {
    if (!gamesByDate.has(g.date)) gamesByDate.set(g.date, [])
    gamesByDate.get(g.date)!.push(g)
  }
  const eventsByDate = new Map<string, CalendarEvent[]>()
  const push = (e: CalendarEvent) => {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, [])
    eventsByDate.get(e.date)!.push(e)
  }
  for (const e of sportEvents) {
    if (isCrossCountryEvent(e) ? shown.value['Cross Country'] : showEvents.value) push(e)
  }
  const parishByDate = new Map<string, ParishEvent[]>()
  if (showParish.value) {
    for (const e of parishEvents) {
      if (!parishByDate.has(e.date)) parishByDate.set(e.date, [])
      parishByDate.get(e.date)!.push(e)
    }
  }

  const out = []
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      row.push({
        iso,
        dayNum: day.getDate(),
        inMonth: day.getMonth() === m! - 1,
        isToday: iso === TODAY,
        games: gamesByDate.get(iso) ?? [],
        events: eventsByDate.get(iso) ?? [],
        parish: parishByDate.get(iso) ?? [],
        videos: videosOn(iso)
      })
    }
    out.push(row)
    const last = row[6]!.iso
    if (last >= `${y}-${String(m).padStart(2, '0')}-28` && new Date(last).getMonth() !== m! - 1) break
  }
  return out
})

const monthIndex = computed(() => months.value.indexOf(current.value))
function shiftMonth (delta: number) {
  const next = months.value[monthIndex.value + delta]
  if (next) current.value = next
}

// ---- day detail ----
const openDate = ref<string | null>(null)
const openDay = computed(() => weeks.value.flat().find(d => d.iso === openDate.value))
function openDay_ (iso: string) { openDate.value = iso }

function dayDots (day: { games: typeof data.games; events: CalendarEvent[]; parish: ParishEvent[] }) {
  const marks = day.games.map(g => `var(${sportVar(sportOf(g.season))})`)
  for (const e of day.events) {
    marks.push(isCrossCountryEvent(e) ? `var(${sportVar('Cross Country')})` : 'var(--event)')
  }
  if (day.parish.length) marks.push('var(--gold-deep)')
  return marks.slice(0, 4)
}

function eventChipClass (e: CalendarEvent) {
  if (e.category === 'blackout') return 'chip--blackout'
  if (isCrossCountryEvent(e)) return 'chip--cc'
  return 'chip--event'
}

function eventTag (e: CalendarEvent) {
  if (e.category === 'blackout') return 'NO'
  if (isCrossCountryEvent(e)) return 'CC'
  return 'CYO'
}

onBeforeRouteLeave(() => {
  openDate.value = null
})

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const allOn = computed(() => SPORTS.every(s => shown.value[s]) && showEvents.value && showParish.value)
function toggleAll () {
  const next = !allOn.value
  for (const s of SPORTS) shown.value[s] = next
  showEvents.value = next
  showParish.value = next
}
</script>

<template>
  <div>
    <div class="section__head calhead">
      <h1>Calendar</h1>
      <div class="calhead__nav">
        <button
          type="button"
          class="calhead__dir"
          :disabled="monthIndex <= 0"
          aria-label="Previous month"
          @click="shiftMonth(-1)"
        >‹</button>
        <select v-model="current" aria-label="Month">
          <option v-for="m in months" :key="m" :value="m">{{ label(m) }}</option>
        </select>
        <button
          type="button"
          class="calhead__dir"
          :disabled="monthIndex < 0 || monthIndex >= months.length - 1"
          aria-label="Next month"
          @click="shiftMonth(1)"
        >›</button>
      </div>
    </div>

    <p class="muted small intro">Click any day to see full game details.</p>

    <!-- Key + filters are the same control: the swatch shows the colour, the
         button shows/hides that sport. -->
    <div class="card filters">
      <div class="filters__row">
        <span class="filters__label">Show</span>
        <button
          v-for="s in SPORTS" :key="s"
          class="key" :class="{ 'key--off': !shown[s] }"
          :style="{ '--accent': `var(${sportVar(s)})` }"
          :aria-pressed="shown[s]"
          @click="shown[s] = !shown[s]"
        >
          <span class="key__dot" />{{ s }}
        </button>

        <button
          class="key key--event" :class="{ 'key--off': !showEvents }"
          :aria-pressed="showEvents"
          @click="showEvents = !showEvents"
        >
          <span class="key__dot" />CYO sport dates
        </button>

        <button
          class="key key--parish" :class="{ 'key--off': !showParish }"
          :aria-pressed="showParish"
          @click="showParish = !showParish"
        >
          <span class="key__dot" />Parish dates
        </button>

        <button class="key key--all" @click="toggleAll">
          {{ allOn ? 'Hide all' : 'Show all' }}
        </button>
      </div>

      <div class="filters__row filters__row--team">
        <label class="filters__label" for="teamsel">Team</label>
        <select id="teamsel" v-model="teamFilter">
          <option value="">All teams</option>
          <option v-for="t in teamOptions" :key="t.id" :value="t.id">
            {{ teamLabel(t) }} — {{ t.league }} ({{ sportOf(t.season) }})
          </option>
        </select>
      </div>
    </div>

    <div class="card cal">
      <div class="cal__head"><span v-for="d in DOW" :key="d">{{ d }}</span></div>
      <div v-for="(week, i) in weeks" :key="i" class="cal__week">
        <button
          v-for="day in week" :key="day.iso"
          type="button"
          class="cal__day"
          :class="{
            'is-out': !day.inMonth,
            'is-today': day.isToday
          }"
          :aria-label="`${formatDate(day.iso, { weekday: 'long' })} — ${day.games.length} game(s)`"
          @click="openDay_(day.iso)"
        >
          <span class="cal__num">
            <span class="cal__n">{{ day.dayNum }}</span>
            <span v-if="day.videos.length" class="cal__vid" title="A/V club video">&#9654;</span>
          </span>
          <span v-if="dayDots(day).length" class="cal__dots" aria-hidden="true">
            <i v-for="(c, di) in dayDots(day)" :key="di" :style="{ background: c }" />
          </span>

          <span
            v-for="g in day.games" :key="g.id"
            class="chip" :class="{ 'chip--tourney': g.tournament }"
            :style="{ '--accent': `var(${sportVar(sportOf(g.season))})` }"
            :title="`${g.tournament ? g.tournament.name + ' — ' : ''}${g.team1.name} vs ${g.team2.name} — ${g.venue}`"
          >
            <span v-if="g.tournament" class="chip__cup" title="Tournament">&#127942;</span>
            <span
              v-if="resultClass(g)" class="chip__r" :class="`chip__r--${resultClass(g)}`"
            >{{ resultClass(g)!.toUpperCase() }}</span>
            <span v-else class="chip__t">{{ formatTime(g.startTime).replace(':00', '').toLowerCase() }}</span>
            <span class="chip__label">
              <template v-if="matchup(g).at">@ </template>{{ sides(g).derby
                ? `${displayTeam(g.team1.name, g.season, g.league)} v ${displayTeam(g.team2.name, g.season, g.league)}`
                : displayTeam(sides(g).opponent.name, g.season, g.league) }}
            </span>
          </span>

          <span
            v-for="e in day.events" :key="e.title"
            class="chip"
            :class="eventChipClass(e)"
            :style="isCrossCountryEvent(e) ? { '--accent': `var(${sportVar('Cross Country')})` } : undefined"
            :title="e.title"
          >
            <span class="chip__tag">{{ eventTag(e) }}</span>
            <span class="chip__label">{{ e.title }}</span>
          </span>

          <span
            v-for="e in day.parish" :key="e.title"
            class="chip chip--parish"
            :title="e.title"
          >
            <span class="chip__tag">OLL</span>
            <span class="chip__label">{{ e.title }}</span>
          </span>
        </button>
      </div>
    </div>

    <DayDialog
      :date="openDate"
      :games="openDay?.games ?? []"
      :events="openDay?.events ?? []"
      :parish="openDay?.parish ?? []"
      @close="openDate = null"
    />
  </div>
</template>

<style scoped>
.intro { margin-top: 4px; }
.calhead { align-items: center; }
.calhead__nav { display: flex; align-items: center; gap: 6px; }
.calhead__dir {
  width: 40px; height: 40px; padding: 0; flex: none;
  border: 2px solid var(--navy); background: var(--surface); color: var(--navy);
  font-size: 1.5rem; line-height: 1; cursor: pointer; border-radius: 3px;
}
.calhead__dir:disabled { opacity: .35; cursor: default; }
.calhead__dir:not(:disabled):hover { background: var(--navy); color: #fff; }
@media (prefers-color-scheme: dark) {
  .calhead__dir { border-color: var(--border); color: var(--text); }
}
@media (max-width: 759px) {
  .calhead__nav { width: 100%; }
  .calhead__nav select { flex: 1; min-width: 0; }
}

/* ---- key / filters ---- */
.filters { padding: 10px 12px; margin-bottom: 16px; display: grid; gap: 8px; }
.filters__row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filters__row--team select {
  flex: 1 1 10rem;
  min-width: 0;
  width: 100%;
  max-width: 16rem;
}
.filters__label {
  font-family: var(--font-cond); font-size: .78rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .12em; color: var(--muted);
}
.key {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px; border-radius: 3px; cursor: pointer;
  border: 1.5px solid color-mix(in srgb, var(--accent, var(--muted)) 55%, var(--border));
  background: color-mix(in srgb, var(--accent, var(--muted)) 14%, var(--surface));
  color: var(--text); font-family: var(--font-cond); font-weight: 600;
  font-size: .78rem; letter-spacing: .06em; text-transform: uppercase;
}
.key__dot {
  width: 8px; height: 8px; border-radius: 2px; flex: none;
  background: var(--accent, var(--muted));
}
.key--event { --accent: var(--event); }
.key--parish { --accent: var(--gold-deep); }
.key--off { background: var(--surface); border-color: var(--border); color: var(--muted); }
.key--off .key__dot { background: var(--border); }
.key--all { --accent: var(--muted); font-weight: 550; }

/* ---- month grid ---- */
.cal { overflow: hidden; }
.cal__head, .cal__week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__head {
  background: var(--navy); border-bottom: 0;
  font-family: var(--font-cond); font-size: .82rem; text-transform: uppercase;
  letter-spacing: .14em; color: #fff; font-weight: 600;
}
.cal__head span { padding: 8px 2px; text-align: center; }
.cal__day {
  min-width: 0; min-height: 64px; padding: 4px 3px 6px;
  border: 0; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 3px; align-items: center;
  background: var(--surface); color: inherit; font: inherit; text-align: center; cursor: pointer;
}
.cal__day:hover { background: color-mix(in srgb, var(--gold) 10%, var(--surface)); }
.cal__day:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; }
.cal__day:nth-child(7n) { border-right: 0; }
.cal__week:last-child .cal__day { border-bottom: 0; }
.cal__day.is-out { background: var(--bg); }
.cal__day.is-out .cal__n { color: var(--muted); opacity: .45; }
.cal__num {
  font-family: var(--font-display); font-size: .95rem; line-height: 1;
  display: flex; gap: 2px; align-items: center; justify-content: center;
}
.cal__n {
  display: grid; place-items: center;
  min-width: 28px; height: 28px; padding-inline: 4px; border-radius: 50%;
}
.cal__day.is-today .cal__n {
  background: var(--gold); color: var(--navy);
}
.cal__vid { color: var(--loss); font-size: .62rem; }
.cal__dots {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 3px;
  max-width: 100%; padding-inline: 2px;
}
.cal__dots i {
  width: 6px; height: 6px; border-radius: 50%; flex: none;
}

/* ---- chips ---- */
.chip {
  display: flex; align-items: baseline; gap: 4px; min-width: 0;
  font-family: var(--font-cond); font-weight: 600;
  font-size: .8rem; line-height: 1.3; padding: 3px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  color: var(--text);
  border-left: 3px solid var(--accent);
}
/* Flex children need their own truncation; the parent's ellipsis won't reach them. */
.chip__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip__t { flex: none; opacity: .7; font-variant-numeric: tabular-nums; }
.chip__cup { flex: none; font-size: .75rem; }
/* Bracket games keep their sport colour but carry a gold ring. */
.chip--tourney { box-shadow: inset 0 0 0 1px var(--gold); }
/* Colour means sport, so a result gets a letter rather than repainting the chip. */
.chip__r {
  flex: none; font-weight: 800; font-size: .75rem; letter-spacing: .02em;
  padding: 0 4px; border-radius: 3px; color: #fff;
}
.chip__r--w { background: var(--win); }
.chip__r--l { background: var(--loss); }
.chip__r--t { background: var(--tie); }

/* CYO events read as a different kind of thing, not just another sport. */
.chip--event {
  --accent: var(--event);
  background: color-mix(in srgb, var(--event) 20%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--event) 55%, transparent);
  border-left: 3px solid var(--event);
  font-weight: 650;
  align-items: center;
}
.chip--cc {
  background: color-mix(in srgb, var(--accent) 20%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-left: 3px solid var(--accent);
  font-weight: 650;
  align-items: center;
}
.chip__tag {
  flex: none; font-size: .75rem; font-weight: 800; letter-spacing: .02em;
  background: var(--event); color: #fff; padding: 0 4px; border-radius: 3px;
}
.chip--cc .chip__tag { background: var(--accent); }
/* A no-play day is an absence of games, so it reads recessive, not urgent. */
.chip--blackout {
  --accent: var(--muted);
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--muted) 10%, var(--surface)) 0 6px,
    color-mix(in srgb, var(--muted) 16%, var(--surface)) 6px 12px);
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  border-left: 3px solid var(--muted);
  color: var(--muted); font-weight: 600; align-items: center;
}
.chip--blackout .chip__tag { background: var(--muted); }
.chip--parish {
  --accent: var(--gold-deep);
  background: color-mix(in srgb, var(--gold) 28%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--gold-deep) 55%, transparent);
  border-left: 3px solid var(--gold-deep);
  font-weight: 650;
  align-items: center;
}
.chip--parish .chip__tag { background: var(--navy); color: var(--gold); }

@media (max-width: 759px) {
  .cal__head span {
    font-size: 0;
    letter-spacing: 0;
    padding: 6px 0;
  }
  .cal__head span::first-letter {
    font-size: .78rem;
    letter-spacing: .06em;
  }
  .cal .chip { display: none; }
}
@media (min-width: 760px) {
  .cal__dots { display: none; }
  .cal__day {
    align-items: stretch;
    text-align: left;
    min-height: 96px;
    padding: 6px;
  }
  .cal__num { justify-content: flex-start; }
}
</style>
