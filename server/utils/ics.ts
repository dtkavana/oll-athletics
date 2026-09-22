import snapshot from '~~/data/snapshot.json'

const TZID = 'America/Indiana/Indianapolis'

interface Side { name: string; score: number | null }
interface Game {
  id: string; date: string; startTime: string | null; endTime: string | null
  venue: string | null; status: string | null; league: string | null; division: string | null
  team1: Side; team2: Side; season: string; teamIds: string[]
  homeSide?: 1 | 2 | null
  tournament?: { name: string; round: number | null; host: string | null; notes: string | null }
}
interface Team { id: string; name: string; season: string; league: string; division: string }

export const snap = snapshot as unknown as {
  scrapedAt: string; teams: Team[]; games: Game[]
}

/**
 * Mirror of displayTeam() on the site: drop CYO's colour suffix from our own
 * teams unless we field more than one in that season and league.
 */
const ourNamesByLeague = new Map<string, Set<string>>()
for (const t of snap.teams) {
  const k = `${t.season}|${t.league}`
  if (!ourNamesByLeague.has(k)) ourNamesByLeague.set(k, new Set())
  ourNamesByLeague.get(k)!.add(t.name)
}
const allOurNames = new Set(snap.teams.map(t => t.name))

export function displayTeam (name: string, season?: string | null, league?: string | null) {
  if (!allOurNames.has(name) || !season || !league) return name
  const siblings = ourNamesByLeague.get(`${season}|${league}`)
  if (siblings && siblings.size > 1) return name
  const parts = name.split('-')
  return parts.length > 1 ? parts.slice(0, -1).join('-').trim() : name
}

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

/** RFC 5545 caps content lines at 75 octets; continuations start with a space. */
function fold (line: string) {
  const out: string[] = []
  let buf = line
  while (Buffer.byteLength(buf) > 75) {
    let cut = 75
    while (Buffer.byteLength(buf.slice(0, cut)) > 75) cut--
    out.push(buf.slice(0, cut))
    buf = ' ' + buf.slice(cut)
  }
  out.push(buf)
  return out.join('\r\n')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')

/** Local wall-clock stamp; the VTIMEZONE block resolves it to a real instant. */
function local (date: string, time: string | null, fallbackHour = 12) {
  const [y, m, d] = date.split('-')
  const [hh, mm] = (time ?? `${String(fallbackHour).padStart(2, '0')}:00`).split(':')
  return `${y}${m}${d}T${hh}${mm}00`
}

function addHour (time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${String((h! + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Our team first, "@" when we are the visitor — matching how the site reads. */
function title (g: Game, ourNames: Set<string>) {
  const oursFirst = ourNames.has(g.team1.name)
  const ours = oursFirst ? g.team1 : g.team2
  const opp = oursFirst ? g.team2 : g.team1
  const homeTeam = g.homeSide === 1 ? g.team1 : g.homeSide === 2 ? g.team2 : null
  const away = Boolean(homeTeam) && homeTeam !== ours
  return `${displayTeam(ours.name, g.season, g.league)} ${away ? '@' : 'vs'} ${displayTeam(opp.name, g.season, g.league)}`
}

export function buildIcs (name: string, games: Game[]) {
  const ourNames = new Set(snap.teams.map(t => t.name))
  const now = stamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Our Lady of Lourdes Athletics//CYO Mirror//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(name)}`),
    `X-WR-TIMEZONE:${TZID}`,
    // Tell clients how often to re-poll; we refresh the data daily.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:20071104T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:20070311T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE'
  ]

  for (const g of games) {
    const summary = (g.tournament ? 'Tournament: ' : '') + title(g, ourNames)
    const score = g.status === 'Played' && g.team1.score != null
      ? ` (${g.team1.score}-${g.team2.score})`
      : ''
    const desc = [
      g.tournament && `Bracket: ${g.tournament.name}`,
      g.tournament?.round && `Round ${g.tournament.round}`,
      g.tournament?.notes,
      g.league && `League: ${g.league}`,
      g.division && `Division: ${g.division}`,
      g.status && `Status: ${g.status}`,
      g.season
    ].filter(Boolean).join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.id}@oll-sports`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${TZID}:${local(g.date, g.startTime)}`,
      `DTEND;TZID=${TZID}:${local(g.date, g.endTime ?? addHour(g.startTime))}`,
      fold(`SUMMARY:${esc(summary + score)}`),
      g.venue ? fold(`LOCATION:${esc(g.venue)}`) : '',
      fold(`DESCRIPTION:${esc(desc)}`),
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n') + '\r\n'
}
