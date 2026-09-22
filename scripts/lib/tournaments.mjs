/**
 * Tournament brackets from Athletics_Tournaments.aspx.
 *
 * The listing is a plain grid whose "[Go]" links are __doPostBack targets; each
 * one redirects to tournament_display.aspx, which (like team schedules) holds
 * the selection in session rather than the URL.
 *
 * The bracket itself is a tidy fragment inside <span id="LblBracket">:
 *
 *   <ul class='round round-1'>
 *     <li class='game game-top winner'>St. Roch-Gold <span>25</span></li>
 *     <li class='game game-spacer'>9/8/2026 6:30 PM<br>Little Flower Kb</li>
 *     <li class='game game-bottom'>Christ the King-Black<span>12</span></li>
 *
 * so each matchup is a top/spacer/bottom triple: two sides with scores, and the
 * middle carrying date, time and venue.
 */
import { BASE } from './cyo.mjs'
import { toISODate, to24h } from './parse.mjs'

export const TOURNAMENTS_URL = BASE + 'Athletics_Tournaments.aspx'

/** Rows of the tournament listing, each with its postback target. */
export function tournamentList ($) {
  const out = []
  $('#ctl00_article_Grid_Tournament_ctl00 tr').each((_, tr) => {
    const cells = $(tr).find('td')
    if (cells.length < 3) return
    const href = $(cells[2]).find('a').attr('href') ?? ''
    const target = /__doPostBack\('([^']+)'/.exec(href)?.[1]
    if (!target) return
    out.push({
      rounds: Number($(cells[0]).text().trim()) || null,
      title: $(cells[1]).text().replace(/\s+/g, ' ').trim(),
      target
    })
  })
  return out
}

const clean = s => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

function side ($, li) {
  const $li = $(li)
  const $score = $li.find('span').last()
  const score = clean($score.text())
  $score.remove()
  return {
    name: clean($li.text()),
    score: score === '' || Number.isNaN(Number(score)) ? null : Number(score),
    winner: ($li.attr('class') ?? '').includes('winner')
  }
}

/** Parse one bracket page into rounds of matchups. */
export function parseBracket ($) {
  const meta = {
    title: clean($('#lbl_header').text()),
    host: clean($('#LblHost').text()).replace(/^Host:\s*/i, '') || null,
    status: clean($('#LblStatus').text()) || null,
    notes: clean($('#Lblnotes').text()) || null
  }

  const games = []
  $('#LblBracket ul.round').each((_, ul) => {
    const round = Number(/round-(\d+)/.exec($(ul).attr('class') ?? '')?.[1]) || null
    const items = $(ul).find('li').toArray()
      .filter(li => ($(li).attr('class') ?? '').toLowerCase().includes('game'))

    // game-top / game-spacer / game-bottom, in threes.
    for (let i = 0; i + 2 < items.length; i += 3) {
      const cls = li => ($(li).attr('class') ?? '').toLowerCase()
      if (!cls(items[i]).includes('game-top')) { i -= 2; continue }

      const team1 = side($, items[i])
      const team2 = side($, items[i + 2])
      // The spacer's own text is "date time", with the venue after a <br>.
      const spacerHtml = $(items[i + 1]).html() ?? ''
      const [whenRaw, venueRaw] = spacerHtml.split(/<br\s*\/?>/i)
      const when = clean(whenRaw.replace(/<[^>]+>/g, ''))
      const venue = clean((venueRaw ?? '').replace(/<[^>]+>/g, '')) || null

      const m = /^(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)$/.exec(when)
      games.push({
        round,
        date: m ? toISODate(m[1]) : null,
        startTime: m ? to24h(m[2]) : null,
        venue,
        team1,
        team2
      })
    }
  })
  return { ...meta, games }
}

/** Fetch the listing and every bracket on it. */
export async function fetchTournaments (client, { formState, log = () => {} } = {}) {
  const $list = await client.get(TOURNAMENTS_URL)
  const rows = tournamentList($list)
  log(`${rows.length} tournament(s) listed`)

  const out = []
  for (const row of rows) {
    const $b = await client.post(TOURNAMENTS_URL, {
      ...formState($list),
      __EVENTTARGET: row.target,
      __EVENTARGUMENT: '',
      ctl00_article_Grid_Tournament_ClientState: ''
    })
    const bracket = parseBracket($b)
    out.push({ ...bracket, title: bracket.title || row.title, rounds: row.rounds })
    log(`   ${bracket.title || row.title}: ${bracket.games.length} matchup(s)`)
  }
  return out
}

/**
 * Reduce a league name or tournament title to a comparable {level, tier} key.
 *
 *   "2026 Fall Kickball Tourney - Cadet A" -> { level: 'cadet', tier: 'a' }
 *   "Cadet A Fall"                         -> { level: 'cadet', tier: 'a' }
 *   "34 League" / "3/4 Mixed Fall"         -> { level: '34',    tier: null }
 *
 * Grades are kept distinct ('3', '4' and '34' are different competitions) so a
 * "4th Grade" bracket never attaches to a 3/4 Mixed team.
 */
export function leagueKey (text) {
  // "56A" has no word boundary to anchor on; give the tier one.
  const t = (text || '').toLowerCase().replace(/(\d)\s*([abc])\b/g, '$1 $2')

  const level =
    /\bcadet\b/.test(t) ? 'cadet'
      : /\b56\b|5\/6/.test(t) ? '56'
        : /\b34\b|3\/4/.test(t) ? '34'
          : /\b4th\b|\b4\s*grade\b/.test(t) ? '4'
            : /\b3rd\b|\b3\s*grade\b/.test(t) ? '3'
              : /high school|\bhs\b/.test(t) ? 'hs'
                : null

  const tier = /\b([abc])\b/.exec(t)?.[1] ?? null
  return { level, tier }
}

/** Sport named in a tournament title, matching sportOf() on a season label. */
export function sportInTitle (title) {
  const m = /(volleyball|football|basketball|kickball|soccer|softball|baseball|wrestling|track|cross ?country)/i
    .exec(title || '')
  if (!m) return null
  const s = m[1].toLowerCase()
  return s === 'crosscountry' || s === 'cross country'
    ? 'Cross Country'
    : s[0].toUpperCase() + s.slice(1)
}
