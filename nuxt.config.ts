import snapshot from './data/snapshot.json'

// Every team we hold, including seasons CYO has retired.
const teamIds = [...new Set((snapshot as { teams: { id: string }[] }).teams.map(t => t.id))]

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // GitHub project Pages lives at /oll-athletics/. Local/dev stays at /.
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  css: [
    // Self-hosted so the site has no third-party font dependency.
    '@fontsource/anton/400.css',
    '@fontsource/barlow/400.css',
    '@fontsource/barlow/600.css',
    '@fontsource/barlow/700.css',
    '@fontsource/barlow-condensed/600.css',
    '@fontsource/barlow-condensed/700.css',
    '~/assets/css/main.css'
  ],

  routeRules: {
    '/football-ratings': { redirect: '/2026/football' },
    '/volleyball-ratings': { redirect: '/2026/volleyball' },
    '/basketball-ratings': { redirect: '/2026-27/basketball' },
    '/ratings': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/ratings/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/2026/volleyball': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/2026/football': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/2026-27/basketball': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/2025-26/basketball': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } }
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      failOnError: false,
      // Dynamic team pages and calendar feeds are not reachable by crawling alone.
      routes: [
        '/', '/calendar', '/scores', '/standings', '/teams', '/watch',
        '/ratings', '/2026/volleyball', '/2026/football', '/2026-27/basketball', '/2025-26/basketball',
        '/ratings/basketball/cadet/oll', '/ratings/basketball/cadet/oll/eec52b6524e8',
        '/ics/all-games.ics',
        ...teamIds.map(id => `/teams/${id}`),
        ...teamIds.map(id => `/ics/${id}.ics`)
      ]
    }
  }
})
