<script setup lang="ts">
import { data } from '~/composables/useSnapshot'

const updated = computed(() =>
  new Date(data.scrapedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Indiana/Indianapolis'
  }))

const cyoSite = 'https://www.cyoarchindy.org/'
const schoolSite = 'https://www.ollindy.org/'

useHead({
  titleTemplate: t => (t ? `${t} · OLL Lyons Athletics` : 'OLL Lyons Athletics'),
  htmlAttrs: { lang: 'en' },
  link: [{ rel: 'icon', href: publicUrl('brand/lion-gold-sm.png') }],
  meta: [
    { name: 'description', content: 'Schedules, scores and standings for Our Lady of Lourdes Lyons and East Side Crusaders CYO teams.' },
    { name: 'theme-color', content: '#002B5C' }
  ]
})
</script>

<template>
  <div :style="{ '--lion-mark': `url('${publicUrl('brand/lion-gold.png')}')` }">
    <NuxtRouteAnnouncer />

    <header class="masthead">
      <div class="wrap masthead__inner">
        <img class="masthead__lion" :src="publicUrl('brand/lion-gold.png')" alt="" width="84" height="84">
        <div>
          <h1>Lourdes <em>Lyons</em> Athletics</h1>
        </div>
      </div>
    </header>
    <div class="varsity" />

    <nav class="nav" aria-label="Main">
      <div class="wrap">
        <ul>
          <li><NuxtLink to="/">Home</NuxtLink></li>
          <li><NuxtLink to="/at-oll">@ OLL</NuxtLink></li>
          <li><NuxtLink to="/calendar">Calendar</NuxtLink></li>
          <li><NuxtLink to="/scores">Scores</NuxtLink></li>
          <li><NuxtLink to="/standings">Standings</NuxtLink></li>
          <li><NuxtLink to="/teams">Teams</NuxtLink></li>
          <li><NuxtLink to="/watch">Watch</NuxtLink></li>
          <li><NuxtLink to="/parents">Parents</NuxtLink></li>
        </ul>
      </div>
    </nav>

    <main class="content">
      <div class="wrap">
        <NuxtPage />
      </div>
    </main>

    <footer>
      <div class="wrap foot">
        <img class="foot__lion" :src="publicUrl('brand/lion-gold.png')" alt="" width="64" height="64">
        <div>
          <p><strong>Go Lyons!</strong></p>
          <nav class="foot__links" aria-label="Related sites">
            <a :href="cyoSite" target="_blank" rel="noopener noreferrer">
              CYO Archdiocese of Indianapolis <span aria-hidden="true">&nearr;</span>
            </a>
            <a :href="schoolSite" target="_blank" rel="noopener noreferrer">
              Our Lady of Lourdes School <span aria-hidden="true">&nearr;</span>
            </a>
          </nav>
          <p>Scores and schedules last updated {{ updated }}.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@import "~/assets/css/main.css";

.foot { display: flex; gap: 18px; align-items: flex-start; }
.foot__lion { flex: none; opacity: .85; }
.foot p { margin: 0 0 6px; max-width: 62ch; }
</style>
