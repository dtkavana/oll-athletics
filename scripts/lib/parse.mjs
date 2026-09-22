/**
 * Parsers for the free-text blobs CYO packs into grid cells, e.g.
 *   team cell: "OL Lourdes-Blue League: Cadet A Girls Division: 1N Score: 19"
 *   info cell: "Venue: OL Lourdes Gym Date: 9/21/2026 12:00:00 AM Time: 8:00 PM-9:00 PM Status: Played"
 */
import { createHash } from 'node:crypto'

/** Pull "Label: value" out of a blob, stopping at the next known label. */
function field (text, label, stops) {
  const re = new RegExp(`${label}:\\s*(.*?)\\s*(?=${stops.map(s => s + ':').join('|')}|$)`, 'i')
  return re.exec(text)?.[1]?.trim() || null
}

const TEAM_STOPS = ['League', 'Division', 'Score']
const INFO_STOPS = ['Venue', 'Date', 'Time', 'Status']

export function parseTeamCell (text) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null
  const name = (t.split(/League:/i)[0] || '').trim()
  const scoreRaw = field(t, 'Score', TEAM_STOPS)
  const score = scoreRaw != null && scoreRaw !== '' && !Number.isNaN(Number(scoreRaw))
    ? Number(scoreRaw)
    : null
  return {
    name: name || t,
    league: field(t, 'League', TEAM_STOPS),
    division: field(t, 'Division', TEAM_STOPS),
    score
  }
}

/** "8:00 PM" -> "20:00". Returns null on anything unexpected. */
export function to24h (s) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((s || '').trim())
  if (!m) return null
  let h = Number(m[1]) % 12
  if (/pm/i.test(m[3])) h += 12
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** "9/21/2026 12:00:00 AM" -> "2026-09-21" (the time part here is always midnight noise). */
export function toISODate (s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec((s || '').trim())
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function parseInfoCell (text) {
  const t = text.replace(/\s+/g, ' ').trim()
  const timeRaw = field(t, 'Time', INFO_STOPS)
  const [start, end] = (timeRaw || '').split('-').map(x => x && x.trim())
  return {
    venue: field(t, 'Venue', INFO_STOPS),
    date: toISODate(field(t, 'Date', INFO_STOPS)),
    startTime: to24h(start),
    endTime: to24h(end),
    status: field(t, 'Status', INFO_STOPS)
  }
}

/** "Games for September,2026" month separator rows carry no game data. */
export const isMonthHeader = cells =>
  cells.length <= 2 && /^Games for /i.test(cells[cells.length - 1] || '')

export const isEmptyNotice = cells =>
  cells.length <= 2 && /No Games|There Are No/i.test(cells[cells.length - 1] || '')

/**
 * Stable id so the same fixture seen from both teams' schedules collapses to
 * one game, and so ids survive re-scrapes unchanged.
 */
export function gameId (g) {
  const key = [g.date, g.startTime, g.venue, g.league, g.division, g.team1?.name, g.team2?.name]
    .map(x => x ?? '').join('|').toLowerCase()
  return createHash('sha1').update(key).digest('hex').slice(0, 12)
}

export const slug = s => (s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * The coach cell holds one or more "Last,First" names separated by <br>, and
 * casing is whatever the parish typed ("Anglemyer,carrie"). Normalise to
 * "First Last", drop duplicates and the "None Assigned" placeholder.
 */
export function parseCoaches (cellHtml) {
  if (!cellHtml) return []
  const names = cellHtml
    .split(/<br\s*\/?>/i)
    .map(s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => s && !/^none assigned$/i.test(s))
    .map(s => {
      const [last, first] = s.split(',').map(x => x && x.trim())
      return titleCase(first ? `${first} ${last}` : s)
    })
  return [...new Set(names)]
}

// Only re-case words the parish typed in all-lower or all-upper; leave
// deliberate mixed case ("McNulty", "DeSantis") alone.
const titleCase = s => s.replace(/\b[\p{L}][\p{L}'’-]*/gu, w =>
  (w === w.toLowerCase() || w === w.toUpperCase())
    ? w[0].toUpperCase() + w.slice(1).toLowerCase()
    : w)
