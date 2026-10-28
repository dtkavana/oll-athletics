<script setup lang="ts">
import volleyball from '~~/data/ratings/2026-fall-girls-volleyball.json'
import football from '~~/data/ratings/2026-fall-boys-football.json'
import basketball from '~~/data/ratings/2025-26-boys-basketball-56.json'

useHead({
  title: 'Ratings',
  meta: [{ name: 'robots', content: 'noindex' }]
})

function updated (iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Indiana/Indianapolis'
  })
}

const boards = [
  {
    to: '/2026/volleyball',
    sport: 'Volleyball',
    season: volleyball.season,
    coverage: volleyball.bands.map(b => b.label).join(' · '),
    teams: volleyball.summary.teams,
    games: volleyball.summary.games,
    updated: updated(volleyball.generatedAt),
    accent: 'var(--sport-1)'
  },
  {
    to: '/2026/football',
    sport: 'Football',
    season: football.season,
    coverage: football.bands.map(b => b.label).join(' · '),
    teams: football.summary.teams,
    games: football.summary.games,
    updated: updated(football.generatedAt),
    accent: 'var(--sport-2)'
  },
  {
    to: '/2025-26/basketball',
    sport: 'Basketball',
    season: basketball.season,
    coverage: '5th / 6th',
    teams: basketball.summary.teams,
    games: basketball.summary.games,
    updated: updated(basketball.generatedAt),
    accent: 'var(--sport-other)'
  }
]
</script>

<template>
  <div>
    <div class="section__head">
      <h1>Ratings</h1>
    </div>
    <p class="muted small lead">
      Elo boards for the seasons we rate. Each page is its own sport.
    </p>

    <ul class="boards">
      <li v-for="board in boards" :key="board.to">
        <NuxtLink class="card board" :to="board.to" :style="{ '--accent': board.accent }">
          <span class="board__sport">{{ board.sport }}</span>
          <span class="board__season">{{ board.season }}</span>
          <span class="board__coverage">{{ board.coverage }}</span>
          <span class="board__meta muted small">
            {{ board.teams }} teams · {{ board.games }} games · Updated {{ board.updated }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 18px; max-width: 62ch; }
.boards { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.board {
  display: grid;
  gap: 4px;
  padding: 14px 16px 14px 18px;
  border-left: 6px solid var(--accent);
  text-decoration: none;
  color: inherit;
}
.board:hover { border-color: var(--accent); background: var(--bg-alt); }
.board__sport {
  font-family: var(--font-display);
  font-size: 1.35rem;
  letter-spacing: .02em;
  line-height: 1.1;
}
.board__season { font-weight: 600; }
.board__coverage {
  font-family: var(--font-cond);
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  font-size: .84rem;
  color: var(--muted);
}
.board__meta { margin-top: 2px; }
</style>
