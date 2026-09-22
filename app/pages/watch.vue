<script setup lang="ts">
import { videos, channel, formatDate, data, isGameVideo, displayTeam } from '~/composables/useSnapshot'

useHead({ title: 'Watch' })

const decorated = computed(() => videos.map(v => ({
  ...v,
  isGame: isGameVideo(v),
  // Only game-titled videos get a fixture association; the club also films
  // concerts and Masses, and those would match a same-day game spuriously.
  games: isGameVideo(v) ? data.games.filter(g => g.date === v.date) : []
})))
const gameVideos = computed(() => decorated.value.filter(v => v.isGame))
const otherVideos = computed(() => decorated.value.filter(v => !v.isGame))
</script>

<template>
  <div>
    <h1>Watch</h1>
    <p class="muted small">
      The OLL A/V club &mdash; middle school students running the broadcasts &mdash; streams
      select games each season.
      <a :href="channel.streams" target="_blank" rel="noopener">See all streams on YouTube &nearr;</a>
    </p>

    <section v-if="gameVideos.length" class="section">
      <div class="section__head"><h2>Game broadcasts</h2></div>
      <div class="grid">
        <a v-for="v in gameVideos" :key="v.id" class="card vid" :href="v.url" target="_blank" rel="noopener">
          <img :src="v.thumb" alt="" width="320" height="180" loading="lazy">
          <div class="vid__body">
            <p class="vid__title">{{ v.title }}</p>
            <p class="muted small">{{ formatDate(v.date, { year: 'numeric' }) }}</p>
            <p v-if="v.games.length" class="muted small">
              Same day as {{ v.games.slice(0, 2).map(g => `${displayTeam(g.team1.name, g.season, g.league)} vs ${displayTeam(g.team2.name, g.season, g.league)}`).join('; ') }}
            </p>
          </div>
        </a>
      </div>
    </section>

    <section v-if="otherVideos.length" class="section">
      <div class="section__head"><h2>Other school videos</h2></div>
      <div class="grid">
        <a v-for="v in otherVideos" :key="v.id" class="card vid" :href="v.url" target="_blank" rel="noopener">
          <img :src="v.thumb" alt="" width="320" height="180" loading="lazy">
          <div class="vid__body">
            <p class="vid__title">{{ v.title }}</p>
            <p class="muted small">{{ formatDate(v.date, { year: 'numeric' }) }}</p>
          </div>
        </a>
      </div>
    </section>

    <p v-if="!videos.length" class="card empty">No recent videos found on the channel.</p>

    <p class="muted small note">
      We keep every broadcast we have seen. YouTube's public feed only exposes the 15 most
      recent uploads at a time, so anything posted before we started watching the channel
      lives on YouTube until a full backfill is run.
      A same-day game is a likely match, not a confirmed one.
    </p>
  </div>
</template>

<style scoped>
.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); margin-top: 16px; }
.vid { overflow: hidden; text-decoration: none; display: flex; flex-direction: column; }
.vid img { width: 100%; height: auto; display: block; background: var(--bg); }
.vid__body { padding: 10px 12px 12px; }
.vid__title { margin: 0 0 4px; font-weight: 650; line-height: 1.3; }
.vid:hover .vid__title { text-decoration: underline; }
.muted a { color: var(--gold-deep); text-decoration: underline; text-underline-offset: 2px; }
.muted a:hover { color: var(--navy); }
@media (prefers-color-scheme: dark) {
  .muted a { color: var(--gold); }
  .muted a:hover { color: var(--gold-bright); }
}
.note { margin-top: 18px; }
</style>
