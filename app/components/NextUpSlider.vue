<script setup lang="ts">
import { type Game, data, TODAY, formatDate, formatTime, isOurs, sportOf, sportVar, matchup, displayTeam, teamLabel } from '~/composables/useSnapshot'

const props = withDefaults(defineProps<{ games: Game[]; interval?: number }>(), { interval: 6000 })

const i = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const count = computed(() => props.games.length)
const go = (n: number) => { i.value = (n + count.value) % count.value }
const next = () => go(i.value + 1)
const prev = () => go(i.value - 1)

/** Manual navigation restarts the clock, so a slide you just chose gets a full
 *  interval instead of being whisked away a moment later. Pause state belongs
 *  to the pointer, so it is deliberately left alone here. */
const pick = (fn: () => void) => { fn(); start() }

function start () {
  stop()
  // Honour the OS "reduce motion" setting: no unattended movement.
  const still = import.meta.client &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still || count.value < 2) return
  timer = setInterval(() => { if (!paused.value) next() }, props.interval)
}
function stop () { if (timer) clearInterval(timer); timer = undefined }

onMounted(start)
onBeforeUnmount(stop)

const teamFor = (g: Game) => data.teams.find(t => g.teamIds.includes(t.id))

const daysAway = (iso: string) => {
  const d = Math.round((new Date(iso + 'T12:00').getTime() - new Date(TODAY + 'T12:00').getTime()) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}
</script>

<template>
  <section
    v-if="count"
    class="slider"
    aria-roledescription="carousel"
    aria-label="Upcoming games"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    @focusin="paused = true"
    @focusout="paused = false"
  >
    <article
      v-for="(g, n) in games" :key="g.id"
      class="slide" :class="{ 'is-on': n === i }"
      :style="{ '--accent': `var(${sportVar(sportOf(g.season))})` }"
      :aria-hidden="n !== i"
      :inert="n !== i ? true : undefined"
    >
      <div class="slide__tag">
        <span class="slide__when">{{ daysAway(g.date) }}</span>
        <span class="slide__sport">{{ sportOf(g.season) }}</span>
      </div>

      <p class="slide__match">
        <span :class="{ ours: isOurs(matchup(g).first.name) }">{{ displayTeam(matchup(g).first.name, g.season, g.league) }}</span>
        <span class="slide__sep" :class="{ 'slide__sep--at': matchup(g).at }">{{ matchup(g).sep }}</span>
        <span :class="{ ours: isOurs(matchup(g).second.name) }">{{ displayTeam(matchup(g).second.name, g.season, g.league) }}</span>
      </p>

      <dl class="slide__facts">
        <div><dt>When</dt><dd>{{ formatDate(g.date, { weekday: 'long' }) }} · {{ formatTime(g.startTime) }}</dd></div>
        <div><dt>Where</dt><dd>{{ g.venue ?? 'TBD' }}</dd></div>
        <div><dt>League</dt><dd>{{ g.league }}</dd></div>
      </dl>

      <NuxtLink v-if="teamFor(g)" class="btn btn--primary" :to="`/teams/${teamFor(g)!.id}`">
        {{ teamLabel(teamFor(g)!) }} team page
      </NuxtLink>
    </article>

    <div v-if="count > 1" class="slider__ui">
      <button class="arrow" aria-label="Previous game" @click="pick(prev)">&#8249;</button>
      <div class="dots" role="tablist">
        <button
          v-for="(g, n) in games" :key="g.id"
          class="dot" :class="{ 'is-on': n === i }"
          role="tab" :aria-selected="n === i"
          :aria-label="`Game ${n + 1} of ${count}`"
          @click="pick(() => go(n))"
        />
      </div>
      <button class="arrow" aria-label="Next game" @click="pick(next)">&#8250;</button>
    </div>
  </section>
</template>

<style scoped>
.slider {
  position: relative; overflow: hidden;
  background:
    radial-gradient(700px 240px at 100% 0%, rgba(221, 180, 38, .2), transparent 65%),
    linear-gradient(160deg, var(--navy) 0%, var(--navy-deep) 100%);
  color: #fff; border-radius: var(--radius); margin-bottom: 18px;
}
.slider::after {
  content: ''; position: absolute; right: -50px; bottom: -70px;
  width: 300px; height: 300px;
  background: var(--lion-mark) center/contain no-repeat;
  opacity: .12; pointer-events: none;
}

/* Slides stack; only the active one takes part in layout. */
.slide {
  display: none;
  padding: 20px 22px 22px;
  border-left: 8px solid var(--accent);
  position: relative; z-index: 1;
}
.slide.is-on { display: block; }
@media (prefers-reduced-motion: no-preference) {
  .slide.is-on { animation: fade .45s ease both; }
}
@keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.slide__tag { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.slide__when {
  background: var(--gold); color: var(--navy);
  font-family: var(--font-cond); font-weight: 600; font-size: .86rem;
  letter-spacing: .14em; text-transform: uppercase; padding: 3px 10px; border-radius: 3px;
}
.slide__sport {
  font-family: var(--font-cond); font-weight: 600; font-size: .86rem;
  letter-spacing: .16em; text-transform: uppercase; color: #9FB6D6;
}

.slide__match {
  margin: 0 0 14px; font-family: var(--font-cond); font-weight: 700;
  font-size: clamp(1.35rem, 4vw, 2.15rem); line-height: 1.15; letter-spacing: .04em; text-transform: uppercase;
}
.slide__match .ours { color: var(--gold); }
.slide__sep { font-family: var(--font-cond); font-size: .78em; color: #7E97BC; margin: 0 8px; }
.slide__sep--at { color: #fff; font-weight: 700; }

.slide__facts {
  display: grid; gap: 12px; margin: 0 0 16px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.slide__facts dt {
  font-family: var(--font-cond); font-size: .76rem; letter-spacing: .16em;
  text-transform: uppercase; color: #7E97BC;
}
.slide__facts dd { margin: 2px 0 0; font-weight: 600; }

/* ---- controls ---- */
.slider__ui {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 0 14px 14px;
}
.arrow {
  width: 44px; height: 44px; flex: none; cursor: pointer;
  border: 2px solid rgba(255, 255, 255, .35); border-radius: 3px;
  background: transparent; color: #fff;
  font-size: 1.3rem; line-height: 1; font-family: var(--font-body);
}
.arrow:hover { border-color: var(--gold); color: var(--gold); }
.dots { display: flex; gap: 2px; }
/* The dot is the visual; the button around it is the 44px touch target. */
.dot {
  width: 40px; height: 44px; padding: 0; cursor: pointer;
  border: 0; background: transparent;
  display: grid; place-items: center;
}
.dot::before {
  content: ''; width: 12px; height: 12px; border-radius: 2px;
  border: 2px solid rgba(255, 255, 255, .45);
}
.dot.is-on::before { background: var(--gold); border-color: var(--gold); }
.arrow:focus-visible, .dot:focus-visible { outline: 3px solid var(--gold); outline-offset: -4px; }
</style>
