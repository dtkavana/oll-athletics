/**
 * Tournament brackets for ratings scripts.
 *
 * Unlike the main scrape (which only keeps games involving our parish), ratings
 * need every scored matchup in a bracket that maps to a league we already rate.
 * Bracket titles name the sport and grade/tier; they do not always name the
 * season term, so matching is sport + year + leagueKey (+ football division).
 */
import { formState } from './cyo.mjs'
import { gameId } from './parse.mjs'
import {
  combineBrackets, mergeTournamentCache, readTournamentCache
} from './tournament-cache.mjs'
import { fetchTournaments, leagueKey, sportInTitle } from './tournaments.mjs'

/** "2026 Fall Girls Volleyball" -> "Volleyball". Same idea as scrape.mjs. */
export function sportOfSeason (season) {
  return season
    .replace(/^\d{4}(-\d{4})?\s+/, '')
    .replace(/^(Fall|Spring|Winter)\s+/, '')
    .replace(/\b(Boys|Girls|CO-ED|Co-Ed|High School|&)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || season
}

/** Football divisions are A / AA / AAA; prefer the longest match. */
function footballDivision (title) {
  return /\b(AAA|AA|A)\b/i.exec(title || '')?.[1]?.toUpperCase() ?? null
}

/**
 * Map a bracket title onto one { league, division } among the rated teams.
 * Returns null when the bracket is a different sport/year or no league fits.
 */
export function matchRatingsLeague (title, season, teams) {
  const sport = sportInTitle(title)
  if (!sport || sport !== sportOfSeason(season)) return null
  const year = /\b(20\d{2})\b/.exec(title)?.[1]
  if (year && !season.includes(year)) return null

  const want = leagueKey(title)
  if (!want.level) return null

  const list = [...(teams.values?.() ?? teams)]
  const footballStyle = list.some(t => /^(AAA|AA|A)$/i.test(t.division || ''))
  const fbDiv = footballStyle ? footballDivision(title) : null

  const hits = new Map()
  for (const t of list) {
    const got = leagueKey(t.league)
    if (got.level !== want.level) continue
    if (footballStyle) {
      // Football brackets are per division (A / AA / AAA).
      if (fbDiv && (t.division || '').toUpperCase() !== fbDiv) continue
      const key = `${t.league}||${t.division || ''}`
      hits.set(key, { league: t.league, division: t.division ?? null })
    } else {
      // Volleyball (and similar): the league label already has the letter tier,
      // and several CYO divisions can sit inside one league.
      if (got.tier !== want.tier) continue
      hits.set(t.league, { league: t.league, division: null })
    }
  }
  if (hits.size === 1) return [...hits.values()][0]
  return null
}

/**
 * Fetch every CYO bracket and keep scored games that belong to this season's
 * rated leagues. Call after schedules so `teams` already has league/division.
 */
export async function fetchRatingTournaments (client, {
  season,
  teams,
  log = () => {}
} = {}) {
  const live = await fetchTournaments(client, { formState, log })
  const cached = await readTournamentCache()
  const brackets = combineBrackets(live, cached)
  await mergeTournamentCache(live)
  if (brackets.length > live.length) {
    log(`  ${brackets.length - live.length} bracket(s) from cache (no longer listed)`)
  }
  const games = []
  const skipped = []

  for (const b of brackets) {
    const match = matchRatingsLeague(b.title, season, teams)
    if (!match) {
      skipped.push({ title: b.title, reason: 'no matching league' })
      continue
    }

    let kept = 0
    for (const g of b.games) {
      if (!g.date) continue
      if (/^bye$/i.test(g.team1.name) || /^bye$/i.test(g.team2.name)) continue
      if (g.team1.score == null || g.team2.score == null) continue

      const game = {
        date: g.date,
        startTime: g.startTime,
        venue: g.venue,
        status: 'Played',
        league: match.league,
        division: match.division,
        team1: {
          name: g.team1.name,
          score: g.team1.score,
          division: match.division
        },
        team2: {
          name: g.team2.name,
          score: g.team2.score,
          division: match.division
        },
        tournament: {
          name: b.title,
          round: g.round,
          host: b.host,
          notes: b.notes
        }
      }
      game.id = gameId(game)
      games.push(game)
      kept++
    }
    if (kept) log(`  ${b.title} -> ${match.league}${match.division ? ' / ' + match.division : ''}: ${kept} game(s)`)
  }

  return { games, skipped }
}
