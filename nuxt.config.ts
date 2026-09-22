import snapshot from './data/snapshot.json'

// Every team we hold, including seasons CYO has retired.
const teamIds = [...new Set((snapshot as { teams: { id: string }[] }).teams.map(t => t.id))]

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [
    // Self-hosted so the site has no third-party font dependency.
    '@fontsource/anton/400.css',
    '@fontsource/barlow/400.css',
    '@fontsource/barlow/600.css',
    '@fontsource/barlow/700.css',
    '@fontsource/barlow-condensed/600.css',
    '~/assets/css/main.css'
  ],

  nitro: {
    prerender: {
      crawlLinks: true,
      failOnError: false,
      // Dynamic team pages and calendar feeds are not reachable by crawling alone.
      routes: [
        '/', '/calendar', '/scores', '/standings', '/teams', '/watch',
        '/ics/all-games.ics',
        ...teamIds.map(id => `/teams/${id}`),
        ...teamIds.map(id => `/ics/${id}.ics`)
      ]
    }
  }
})
