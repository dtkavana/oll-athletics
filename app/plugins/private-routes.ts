const PRIVATE = [
  '/2026/volleyball',
  '/2026/football',
  '/2026-27/basketball',
  '/2025-26/basketball'
]

function isPrivate (path: string) {
  const p = path.length > 1 ? path.replace(/\/$/, '') : path
  return p === '/ratings' || p.startsWith('/ratings/') || PRIVATE.includes(p)
}

export default defineNuxtPlugin(() => {
  const route = useRoute()
  useHead(() => isPrivate(route.path)
    ? { meta: [{ key: 'robots', name: 'robots', content: 'noindex, nofollow' }] }
    : {})
})
