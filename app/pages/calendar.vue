<script setup lang="ts">
import {
  data, TODAY, formatDate, formatTime,
  sides, resultClass, sportOf, sportVar, sportsForCalendar, videosOn, matchup, displayTeam, teamLabel,
  sportEvents, crossCountrySeason, type CalendarEvent
} from '~/composables/useSnapshot'

useHead({ title: 'Calendar' })

const SPORTS = sportsForCalendar()
const ccSeason = crossCountrySeason()

/** Legend entries double as filters, so the key and the toggles cannot drift. */
const shown = ref<Record<string, boolean>>(
  Object.fromEntries(SPORTS.map(s => [s, true]))
)
const showEvents = ref(true)
const teamFilter = ref('')

const teamOptions = computed(() =>
  [...new Map(data.teams.filter(t => t.gameIds.length)
    .map(t => [t.id, t])).values()]
    .sort((a, b) => a.season.localeCompare(b.season) || a.name.localeCompare(b.name)))

const months = computed(() => {
  const set = new Set<string>()
  for (const g of data.games) set.add(g.date.slice(0, 7))
  for (const e of sportEvents) set.add(e.date.slice(0, 7))
  return [...set].sort()
})
const current = ref(months.value.find(m => m >= TODAY.slice(0, 7)) ?? months.value.at(-1) ?? TODAY.slice(0, 7))

const label = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const SPORT_IN_TEXT = /(volleyball|football|basketball|kickball|soccer|softball|baseball|wrestling|track|cross ?country)/i
function shownEvent (e: CalendarEvent) {
  const m = SPORT_IN_TEXT.exec(e.title)
  if (!m) return true
  return !gamelessSports.has(m[1]!.toLowerCase().replace(/\s+/g, ''))
}

const visibleGames = computed(() => data.games.filter(g => {
  if (!shown.value[sportOf(g.season)]) return false
  if (teamFilter.value && !g.teamIds.includes(teamFilter.value)) return false
  return true
}))

/** Sports present in the month being viewed — the key only lists what's on screen. */
const monthSports = computed(() => {
  const present = new Set(
    data.games.filter(g => g.date.startsWith(current.value)).map(g => sportOf(g.season)))
  return SPORTS.filter(s => present.has(s))
})

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
  // Cross country and the like are described on the teams page instead: with no
  // fixtures they would otherwise appear here as two lonely CYO chips.
  if (showEvents.value) sportEvents.filter(shownEvent).forEach(push)

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
        videos: videosOn(iso),
        ccInSeason: Boolean(
          ccSeason && iso >= ccSeason.start && iso <= ccSeason.end
        ),
        ccStart: ccSeason?.start === iso,
        ccEnd: ccSeason?.end === iso
      })
    }
    out.push(row)
    const last = row[6]!.iso
    if (last >= `${y}-${String(m).padStart(2, '0')}-28` && new Date(last).getMonth() !== m! - 1) break
  }
  return out
})

const agenda = computed(() =>
  weeks.value.flat().filter(d =>
    d.inMonth && (d.games.length || d.events.length
      || (d.ccInSeason && shown.value['Cross Country']))))

// ---- day detail ----
const openDate = ref<string | null>(null)
const openDay = computed(() => weeks.value.flat().find(d => d.iso === openDate.value))
function openDay_ (iso: string) { openDate.value = iso }

onBeforeRouteLeave(() => {
  openDate.value = null
})

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const allOn = computed(() => SPORTS.every(s => shown.value[s]) && showEvents.value)
function toggleAll () {
  const next = !allOn.value
  for (const s of SPORTS) shown.value[s] = next
  showEvents.value = next
}
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Calendar</h1>
      <select v-model="current" aria-label="Month">
        <option v-for="m in months" :key="m" :value="m">{{ label(m) }}</option>
      </select>
    </div>

    <p class="muted small intro">
      Click any day to see full game details.
      <a href="/ics/all-games.ics">Subscribe to every game (.ics)</a>
    </p>

    <div
      v-if="ccSeason && ccSeason.start <= TODAY && TODAY <= ccSeason.end"
      class="card cc-season"
      :style="{ '--accent': `var(${sportVar('Cross Country')})` }"
    >
      <p class="cc-season__title">Cross Country in season</p>
      <p class="cc-season__dates">
        Started {{ formatDate(ccSeason.start, { weekday: 'long', month: 'long', day: 'numeric' }) }}.
        Finishes {{ formatDate(ccSeason.end, { weekday: 'long', month: 'long', day: 'numeric' }) }}
        (championship).
      </p>
    </div>

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

        <button class="key key--all" @click="toggleAll">
          {{ allOn ? 'Hide all' : 'Show all' }}
        </button>
      </div>

      <div class="filters__row">
        <label class="filters__label" for="teamsel">Team</label>
        <select id="teamsel" v-model="teamFilter">
          <option value="">All teams</option>
          <option v-for="t in teamOptions" :key="t.id" :value="t.id">
            {{ teamLabel(t) }} — {{ t.league }} ({{ sportOf(t.season) }})
          </option>
        </select>
      </div>
    </div>

    <!-- Month grid: desktop -->
    <div class="card cal">
      <div class="cal__head"><span v-for="d in DOW" :key="d">{{ d }}</span></div>
      <div v-for="(week, i) in weeks" :key="i" class="cal__week">
        <button
          v-for="day in week" :key="day.iso"
          type="button"
          class="cal__day"
          :class="{
            'is-out': !day.inMonth,
            'is-today': day.isToday,
            'is-cc': day.inMonth && day.ccInSeason && shown['Cross Country']
          }"
          :aria-label="`${formatDate(day.iso, { weekday: 'long' })} — ${day.games.length} game(s)`"
          @click="openDay_(day.iso)"
        >
          <span class="cal__num">
            {{ day.dayNum }}
            <span v-if="day.videos.length" class="cal__vid" title="A/V club video">&#9654;</span>
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
            class="chip" :class="e.category === 'blackout' ? 'chip--blackout' : 'chip--event'"
            :title="e.title"
          >
            <span class="chip__tag">{{ e.category === 'blackout' ? 'NO' : 'CYO' }}</span>
            <span class="chip__label">{{ e.title }}</span>
          </span>

          <span
            v-if="day.inMonth && day.ccInSeason && shown['Cross Country'] && !day.ccStart && !day.ccEnd"
            class="chip chip--cc"
            :style="{ '--accent': `var(${sportVar('Cross Country')})` }"
            title="Cross Country season"
          >
            <span class="chip__label">Cross Country</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Agenda: phones. Uses the same row component as every other list so a
         game reads identically wherever you meet it. -->
    <div class="agenda">
      <section v-for="day in agenda" :key="day.iso" class="card agenda__day">
        <button
          type="button"
          class="daybar agenda__bar"
          :class="{ 'daybar--today': day.isToday }"
          @click="openDay_(day.iso)"
        >
          <span>{{ formatDate(day.iso, { weekday: 'long' }) }}</span>
          <span class="agenda__count">
            {{ day.games.length }} game<template v-if="day.games.length !== 1">s</template> &rsaquo;
          </span>
        </button>

        <ul class="list">
          <GameRow v-for="g in day.games" :key="g.id" :game="g" :show-date="false" />
        </ul>

        <p
          v-for="e in day.events" :key="e.title"
          class="agenda__ev" :class="{ 'agenda__ev--blackout': e.category === 'blackout' }"
        >
          <span class="agenda__tag">{{ e.category === 'blackout' ? 'NO PLAY' : 'CYO' }}</span>
          {{ e.title }}
        </p>
        <p
          v-if="day.ccInSeason && shown['Cross Country'] && !day.events.some(e => /cross country/i.test(e.title))"
          class="agenda__ev agenda__ev--cc"
        >
          <span class="agenda__tag">CC</span>
          Cross Country season
        </p>
      </section>
      <p v-if="!agenda.length" class="card empty">Nothing matches these filters this month</p>
    </div>

    <p v-if="monthSports.length" class="muted small legendnote">
      Colour shows the sport. Played games carry a <strong>W</strong>, <strong>L</strong> or
      <strong>T</strong> badge; upcoming games show their start time.
      CYO dates are sport dates only &mdash; start dates, deadlines, playoffs and championships.
      &#127942; marks a tournament bracket game. <strong>@</strong> means a road game.
    </p>

    <DayDialog
      :date="openDate"
      :games="openDay?.games ?? []"
      :events="openDay?.events ?? []"
      @close="openDate = null"
    />
  </div>
</template>

<style scoped>
.intro { margin-top: 4px; }

/* ---- key / filters ---- */
.filters { padding: 12px 14px; margin-bottom: 16px; display: grid; gap: 10px; }
.filters__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filters__label {
  font-family: var(--font-cond); font-size: .84rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .14em; color: var(--muted);
}
.key {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 13px; min-height: 44px; border-radius: 3px; cursor: pointer;
  border: 2px solid color-mix(in srgb, var(--accent, var(--muted)) 55%, var(--border));
  background: color-mix(in srgb, var(--accent, var(--muted)) 14%, var(--surface));
  color: var(--text); font-family: var(--font-cond); font-weight: 600;
  font-size: .95rem; letter-spacing: .08em; text-transform: uppercase;
}
.key__dot {
  width: 10px; height: 10px; border-radius: 3px; flex: none;
  background: var(--accent, var(--muted));
}
.key--event { --accent: var(--event); }
.key--off { background: var(--surface); border-color: var(--border); color: var(--muted); }
.key--off .key__dot { background: var(--border); }
.key--all { --accent: var(--muted); font-weight: 550; }

/* ---- month grid ---- */
.cal { display: none; overflow: hidden; }
.cal__head, .cal__week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__head {
  background: var(--navy); border-bottom: 0;
  font-family: var(--font-cond); font-size: .82rem; text-transform: uppercase;
  letter-spacing: .14em; color: #fff; font-weight: 600;
}
.cal__head span { padding: 8px; text-align: center; }
.cal__day {
  min-width: 0; min-height: 96px; padding: 6px;
  border: 0; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 3px; align-items: stretch;
  background: var(--surface); color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.cal__day:hover { background: color-mix(in srgb, var(--gold) 10%, var(--surface)); }
.cal__day:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; }
.cal__day:nth-child(7n) { border-right: 0; }
.cal__week:last-child .cal__day { border-bottom: 0; }
.cal__day.is-out { background: var(--bg); }
.cal__day.is-out .cal__num { color: var(--muted); opacity: .5; }
.cal__day.is-today { background: color-mix(in srgb, var(--gold) 20%, transparent); }
.cal__day.is-today .cal__num { color: var(--navy); }
.cal__day.is-cc {
  background: color-mix(in srgb, var(--sport-5) 8%, var(--surface));
}
.cc-season {
  margin-bottom: 14px;
  padding: 14px 16px;
  border-left: 5px solid var(--accent);
}
.cc-season__title {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1.05rem;
  text-transform: uppercase;
  color: var(--navy);
}
.cc-season__dates { margin: 0; font-size: .92rem; max-width: 62ch; }
@media (prefers-color-scheme: dark) { .cc-season__title { color: var(--gold); } }
.chip--cc {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-left: 3px solid var(--accent);
  font-weight: 650;
}
.agenda__ev--cc {
  border-color: color-mix(in srgb, var(--sport-5) 45%, transparent);
  border-left-color: var(--sport-5);
  background: color-mix(in srgb, var(--sport-5) 12%, var(--surface));
}
.agenda__ev--cc .agenda__tag { background: var(--sport-5); }
.cal__num {
  font-family: var(--font-display); font-size: .95rem; line-height: 1;
  display: flex; gap: 4px; align-items: center; margin-bottom: 2px;
}
.cal__vid { color: var(--loss); font-size: .62rem; }

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
.chip__tag {
  flex: none; font-size: .75rem; font-weight: 800; letter-spacing: .02em;
  background: var(--event); color: #fff; padding: 0 4px; border-radius: 3px;
}
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
.chip--wide { margin: 0 10px 6px; }
.chip--wide .chip__label { white-space: normal; }

/* ---- agenda ---- */
.agenda { display: grid; gap: 14px; }
.agenda__day { padding: 0 0 4px; overflow: hidden; }
.agenda__bar {
  width: 100%; border: 0; cursor: pointer; text-align: left;
  min-height: 46px; align-items: center;
}
.agenda__count { opacity: .85; }
.list { margin: 0; padding: 0; list-style: none; }

.agenda__ev {
  margin: 8px 10px 4px; padding: 10px 12px;
  display: flex; align-items: center; gap: 9px;
  border: 1px solid color-mix(in srgb, var(--event) 55%, transparent);
  border-left: 5px solid var(--event);
  background: color-mix(in srgb, var(--event) 14%, var(--surface));
  border-radius: var(--radius); font-weight: 600; font-size: .95rem;
}
.agenda__ev--blackout {
  border-color: color-mix(in srgb, var(--muted) 45%, transparent);
  border-left-color: var(--muted);
  background: color-mix(in srgb, var(--muted) 10%, var(--surface));
  color: var(--muted);
}
.agenda__tag {
  flex: none; font-family: var(--font-cond); font-size: .8rem; font-weight: 600;
  letter-spacing: .1em; background: var(--event); color: #fff;
  padding: 2px 7px; border-radius: 3px;
}
.agenda__ev--blackout .agenda__tag { background: var(--muted); }

.legendnote { margin-top: 12px; }

@media (min-width: 900px) {
  .cal { display: block; }
  .agenda { display: none; }
}
</style>
