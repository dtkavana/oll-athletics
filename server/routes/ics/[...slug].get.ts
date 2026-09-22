import { buildIcs, snap, displayTeam } from '~~/server/utils/ics'

/**
 * Per-team and all-games calendar feeds, prerendered to static .ics files
 * (see nitro.prerender.routes) so parents can subscribe in Google/Apple Calendar.
 */
export default defineEventHandler(event => {
  const slug = (getRouterParam(event, 'slug') ?? '').replace(/\.ics$/, '')

  let name: string
  let games = snap.games

  if (slug === 'all-games') {
    name = 'OLL Athletics — all games'
  } else {
    const team = snap.teams.find(t => t.id === slug)
    if (!team) throw createError({ statusCode: 404, statusMessage: 'Unknown calendar' })
    name = `${displayTeam(team.name, team.season, team.league)} — ${team.league} ${team.division}`
    games = snap.games.filter(g => g.teamIds.includes(team.id))
  }

  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return buildIcs(name, games)
})
