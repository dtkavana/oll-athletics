/**
 * Work out which side hosted a game.
 *
 * CYO's team1/team2 ordering does NOT encode home and away -- measured across
 * the archive, team2 is the host slightly more often than team1. The venue is
 * the only reliable signal: "OL Lourdes Gym" is Lourdes' home floor.
 *
 * Venue and team names abbreviate differently ("Immaculate Heart-Kb" vs
 * "Immac. Heart"), so matching is token-based with prefix tolerance rather than
 * a string compare. Plenty of games are at genuinely neutral sites -- high
 * school football fields, Christian Park, the CYO Center -- and those correctly
 * resolve to no host.
 */

/** Venue-type and honorific words that carry no identity. */
const STOP = new Set([
  'of', 'the', 'ss', 'st', 'saint', 'jr', 'sr', 'h', 'hs', 'fb', 'kb',
  'gym', 'gyms', 'field', 'fields', 'court', 'courts', 'school', 'middle',
  'high', 'se', 'sw', 'ne', 'nw', 'north', 'south', 'east', 'west'
])

function tokens (s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    // Single letters ("X" in "St. Pius X") and bare numbers ("#1") are noise.
    .filter(t => t.length > 1 && !/^\d+$/.test(t) && !STOP.has(t))
}

/** "St. Roch-Gold" -> "St. Roch". Team names are "<parish>-<colour>". */
export function parishOf (teamName) {
  const parts = (teamName || '').split('-')
  return (parts.length > 1 ? parts.slice(0, -1).join('-') : teamName).trim()
}

/** Build a matcher over the parishes that actually appear in the data. */
export function venueResolver (parishes) {
  const table = [...new Set(parishes)]
    .map(p => ({ parish: p, t: tokens(p) }))
    .filter(x => x.t.length)

  return function hostParish (venue) {
    const vt = tokens(venue)
    if (!vt.length) return null
    let best = null
    for (const { parish, t } of table) {
      // Every identifying word of the parish must appear in the venue, allowing
      // either side to be an abbreviation of the other.
      const ok = t.every(pt => vt.some(v =>
        v.startsWith(pt) || (pt.startsWith(v) && v.length >= 3)))
      if (!ok) continue
      const score = t.join('').length      // prefer the most specific parish
      if (!best || score > best.score) best = { parish, score }
    }
    return best?.parish ?? null
  }
}

/**
 * 1 or 2 if that side hosted, null at a neutral site.
 * A parish hosting two other parishes' teams is still neutral for that game.
 */
export function homeSide (game, hostParish) {
  const host = hostParish(game.venue)
  if (!host) return null
  if (parishOf(game.team1.name) === host) return 1
  if (parishOf(game.team2.name) === host) return 2
  return null
}
