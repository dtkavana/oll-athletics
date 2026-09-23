<script setup lang="ts">
import {
  type Game, type CalendarEvent,
  formatDate, formatTime, isOurs, sides, resultClass,
  sportOf, sportVar, teamById, gameVideosOn, channel, matchup, displayTeam,
  isCrossCountryEvent, type ParishEvent
} from '~/composables/useSnapshot'

const props = defineProps<{
  date: string | null
  games: Game[]
  events: CalendarEvent[]
  parish?: ParishEvent[]
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

// Drive the native <dialog> so we inherit focus trapping and Esc for free.
function syncDialogOpen () {
  const el = dialog.value
  if (!el) return
  const d = props.date
  if (d && !el.open) el.showModal()
  if (!d && el.open) el.close()
}

watch(() => props.date, () => syncDialogOpen())

onMounted(() => syncDialogOpen())

/** Leaving the page while showModal() is active can leave the document inert. */
onBeforeUnmount(() => {
  const el = dialog.value
  if (el?.open) el.close()
})

const streams = computed(() => props.date ? gameVideosOn(props.date) : [])
const parishList = computed(() => props.parish ?? [])

/** Which of our teams is in this fixture, so we can link to its page. */
function ourTeamId (g: Game) {
  return g.teamIds.find(id => teamById.has(id)) ?? g.teamIds[0]
}
</script>

<template>
  <dialog ref="dialog" class="dlg" @close="emit('close')" @click.self="emit('close')">
    <div v-if="date" class="dlg__box">
      <header class="dlg__head">
        <h2>{{ formatDate(date, { weekday: 'long', year: 'numeric' }) }}</h2>
        <button class="dlg__x" aria-label="Close" @click="emit('close')">&times;</button>
      </header>

      <div class="dlg__body">
        <p v-if="!games.length && !events.length && !parishList.length" class="muted">Nothing scheduled this day.</p>

        <article
          v-for="g in games" :key="g.id"
          class="gm"
          :style="{ '--accent': `var(${sportVar(sportOf(g.season))})` }"
        >
          <div class="gm__top">
            <span class="gm__sport">{{ sportOf(g.season) }}</span>
            <span v-if="g.tournament" class="pill pill--tourney">
              Tournament<template v-if="g.tournament.round"> R{{ g.tournament.round }}</template>
            </span>
            <span class="muted small">
              {{ g.league }}
            </span>
            <span
              v-if="resultClass(g)"
              class="pill" :class="`pill--${resultClass(g)}`"
            >{{ resultClass(g)!.toUpperCase() }} {{ sides(g).ours.score }}&ndash;{{ sides(g).opponent.score }}</span>
            <span v-else class="pill">{{ g.status === 'Played' ? 'Final' : 'Scheduled' }}</span>
          </div>

          <p class="gm__teams">
            <span :class="{ ours: isOurs(matchup(g).first.name) }">{{ displayTeam(matchup(g).first.name, g.season, g.league) }}</span>
            <span v-if="matchup(g).first.score !== null" class="gm__sc">{{ matchup(g).first.score }}</span>
            <span class="gm__sep" :class="{ 'gm__sep--at': matchup(g).at }">{{ matchup(g).sep }}</span>
            <span :class="{ ours: isOurs(matchup(g).second.name) }">{{ displayTeam(matchup(g).second.name, g.season, g.league) }}</span>
            <span v-if="matchup(g).second.score !== null" class="gm__sc">{{ matchup(g).second.score }}</span>
          </p>

          <dl class="gm__meta">
            <div><dt>Time</dt><dd>{{ formatTime(g.startTime) }}<template v-if="g.endTime">&ndash;{{ formatTime(g.endTime) }}</template></dd></div>
            <div>
              <dt>{{ matchup(g).home ? 'Home' : matchup(g).at ? 'Away at' : 'Site' }}</dt>
              <dd>{{ g.venue ?? '—' }}</dd>
            </div>
            <div><dt>Season</dt><dd>{{ g.season }}</dd></div>
            <div v-if="g.tournament"><dt>Bracket</dt><dd>{{ g.tournament.name }}</dd></div>
          </dl>

          <NuxtLink class="btn btn--sm" :to="`/teams/${ourTeamId(g)}`" @click="emit('close')">
            Team page &rarr;
          </NuxtLink>
        </article>

        <article
          v-for="e in events" :key="e.title"
          class="ev"
          :class="{
            'ev--blackout': e.category === 'blackout',
            'ev--cc': isCrossCountryEvent(e)
          }"
          :style="isCrossCountryEvent(e) ? { '--accent': `var(${sportVar('Cross Country')})` } : undefined"
        >
          <span class="ev__tag">{{ e.category === 'blackout' ? 'NO PLAY' : isCrossCountryEvent(e) ? 'CC' : 'CYO' }}</span>
          <p>{{ e.title }}</p>
        </article>

        <article v-for="e in parishList" :key="e.title" class="ev ev--parish">
          <span class="ev__tag">OLL</span>
          <div>
            <p>{{ e.title }}</p>
            <p v-if="e.startTime" class="ev__meta">
              {{ formatTime(e.startTime) }}<template v-if="e.endTime">&ndash;{{ formatTime(e.endTime) }}</template>
            </p>
            <p v-if="e.venue" class="ev__meta">{{ e.venue }}</p>
            <p v-if="e.note" class="ev__note">{{ e.note }}</p>
          </div>
        </article>

        <section v-if="streams.length" class="streams">
          <h3>A/V club video from this day</h3>
          <a v-for="v in streams" :key="v.id" class="stream" :href="v.url" target="_blank" rel="noopener">
            <img :src="v.thumb" alt="" width="120" height="68" loading="lazy">
            <span>{{ v.title }}</span>
          </a>
        </section>
      </div>

      <footer class="dlg__foot">
        <a class="btn btn--sm" :href="channel.streams" target="_blank" rel="noopener">A/V club streams &nearr;</a>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.dlg {
  border: 0; padding: 0; background: transparent;
  max-width: min(640px, 94vw); width: 100%;
}
.dlg:focus, .dlg:focus-visible { outline: none; }
.dlg::backdrop { background: rgba(8, 14, 26, .55); backdrop-filter: blur(2px); }
.dlg__box {
  background: var(--surface); color: var(--text);
  border: 3px solid var(--navy); border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(8, 14, 26, .3);
  max-height: 88vh; display: flex; flex-direction: column;
}
.dlg__head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 18px; background: var(--navy); color: #fff;
}
.dlg__head h2 { color: #fff; }
.dlg__x {
  border: 0; background: transparent; color: #9FB6D6;
  font-size: 1.6rem; line-height: 1; cursor: pointer; padding: 0 4px;
}
.dlg__x:hover { color: var(--gold); }
.dlg__body { padding: 14px 16px; overflow-y: auto; display: grid; gap: 12px; }
.dlg__foot { padding: 12px 16px; border-top: 1px solid var(--border); }

.gm {
  border: 1px solid var(--border); border-left: 6px solid var(--accent);
  border-radius: var(--radius); padding: 12px 14px;
}
.gm__top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.gm__sport {
  font-family: var(--font-cond); font-size: .88rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .12em; color: var(--accent);
}
.gm__teams {
  margin: 0 0 10px; font-family: var(--font-cond); font-weight: 700;
  font-size: 1.15rem; letter-spacing: .03em; text-transform: uppercase; line-height: 1.25;
}
.gm__sc { font-variant-numeric: tabular-nums; font-weight: 700; margin-left: 4px; }
.gm__sep { color: var(--muted); font-family: var(--font-cond); margin: 0 6px; }
.gm__sep--at { color: var(--navy); font-weight: 700; }
@media (prefers-color-scheme: dark) { .gm__sep--at { color: var(--gold); } }
.ours { font-weight: 700; }

.gm__meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin: 0 0 10px; }
.gm__meta dt {
  font-family: var(--font-cond); font-size: .78rem; text-transform: uppercase;
  letter-spacing: .14em; color: var(--muted);
}
.gm__meta dd { margin: 0; font-size: .9rem; }

.btn--sm { padding: 5px 10px; font-size: .8rem; }
.pill--tourney {
  background: color-mix(in srgb, var(--gold) 25%, transparent);
  color: var(--tie); font-weight: 700;
}
@media (prefers-color-scheme: dark) { .pill--tourney { color: var(--gold); } }

.ev {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid color-mix(in srgb, var(--event) 45%, var(--border));
  background: color-mix(in srgb, var(--event) 12%, var(--surface));
  border-radius: 10px; padding: 10px 12px;
}
.ev p { margin: 0; font-weight: 550; }
.ev__tag {
  flex: none; font-size: .66rem; font-weight: 800; letter-spacing: .06em;
  background: var(--event); color: #fff; padding: 2px 6px; border-radius: 4px;
}

.ev--cc {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.ev--cc .ev__tag { background: var(--accent); }
.ev--blackout {
  border-color: color-mix(in srgb, var(--muted) 35%, var(--border));
  background: color-mix(in srgb, var(--muted) 8%, var(--surface));
  color: var(--muted);
}
.ev--blackout .ev__tag { background: var(--muted); }
.ev--parish {
  border-color: color-mix(in srgb, var(--gold-deep) 55%, var(--border));
  background: color-mix(in srgb, var(--gold) 18%, var(--surface));
}
.ev--parish .ev__tag { background: var(--navy); color: var(--gold); }
.ev__meta { margin: 2px 0 0; font-weight: 500; font-size: .9rem; }
.ev__note { margin: 6px 0 0; font-weight: 450; font-size: .88rem; color: var(--muted); }

.streams h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 8px; }
.stream { display: flex; gap: 10px; align-items: center; text-decoration: none; font-size: .9rem; }
.stream img { border-radius: 6px; flex: none; }
.stream:hover span { text-decoration: underline; }
</style>
