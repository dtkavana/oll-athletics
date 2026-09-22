#!/usr/bin/env node
/**
 * Scrape schedules, scores and standings for our parishes from CYO.
 *
 * Writes one file per season under data/seasons/ plus data/snapshot.json for
 * the bits that are not season-scoped (last run, A/V club videos). CYO only
 * lists a rolling window of seasons, so the per-season files accumulate: a run
 * refreshes what it saw and leaves older seasons alone. Run daily.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CyoClient, SCHEDULES_URL, STANDINGS_URL,
  formState, comboOptions, selection, imageButton, gridRows
} from './lib/cyo.mjs'
import { parseTeamCell, parseInfoCell, parseCoaches, isMonthHeader, isEmptyNotice, gameId, slug } from './lib/parse.mjs'
import { fetchVideos, mergeVideos, CHANNEL_URL, STREAMS_URL } from './lib/youtube.mjs'
import { fetchTournaments, leagueKey, sportInTitle } from './lib/tournaments.mjs'
import { readArchive, groupBySeason, mergeSeason, writeArchive } from './lib/archive.mjs'
import { venueResolver, parishOf, homeSide } from './lib/venues.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'data/snapshot.json')
const SEASONS_DIR = resolve(ROOT, 'data/seasons')
const VIDEOS = resolve(ROOT, 'data/videos.json')

/** The parishes this site covers, as labelled in the CYO parish dropdown. */
const ORGS = [
  { key: 'oll', name: 'Our Lady of Lourdes (Indy)', short: 'Our Lady of Lourdes' },
  { key: 'esc', name: 'East Side Crusaders', short: 'East Side Crusaders' }
]

const verbose = process.argv.includes('--verbose')
const log = (...a) => console.error(...a)
const vlog = (...a) => verbose && console.error('   ', ...a)

const teamKey = (season, league, division, name) =>
  [slug(season), slug(league), slug(division), slug(name)].join('--')

/** Rows of the team grid, each paired with the image button that opens it. */
function teamRows ($) {
  const out = []
  $('#ctl00_article_Grid_Teams_ctl00 tr').each((_, tr) => {
    const $tr = $(tr)
    const cells = $tr.find('td').map((_, td) =>
      $(td).text().replace(/\s+/g, ' ').replace(/ /g, ' ').trim()).get()
    const button = $tr.find('input[name*="gbccolumn"]').attr('name')
    if (button && cells.length >= 4) {
      const coaches = parseCoaches($tr.find('td').eq(5).html())
      out.push({ name: cells[0], parish: cells[1], league: cells[2], division: cells[3], coaches, button })
    }
  })
  return out
}

function parseSchedule ($, team) {
  const games = []
  for (const cells of gridRows($, 'ctl00_article_Grid_TeamSchedule_ctl00')) {
    if (cells.length < 4 || isMonthHeader(cells) || isEmptyNotice(cells)) continue
    if (/^Team 1$/i.test(cells[1])) continue
    const t1 = parseTeamCell(cells[1])
    const t2 = parseTeamCell(cells[2])
    const info = parseInfoCell(cells[3])
    if (!t1 || !t2 || !info.date) continue
    const g = {
      date: info.date,
      startTime: info.startTime,
      endTime: info.endTime,
      venue: info.venue,
      status: info.status,
      league: t1.league ?? team.league,
      division: t1.division ?? team.division,
      team1: { name: t1.name, score: t1.score },
      team2: { name: t2.name, score: t2.score }
    }
    g.id = gameId(g)
    games.push(g)
  }
  return games
}

async function scrapeSchedules (client) {
  const teams = []
  const games = new Map()

  for (const org of ORGS) {
    const $base = await client.get(SCHEDULES_URL)
    const venues = comboOptions($base, 'CboVenue')
    const seasons = comboOptions($base, 'CboSeason')
    const venue = venues.find(v => v.label === org.name)
    if (!venue) { log(`! parish "${org.name}" not in dropdown -- skipping`); continue }
    log(`\n== ${org.name} (${seasons.length} seasons)`)

    for (const season of seasons) {
      // WebForms tolerates replaying the base page's __VIEWSTATE, so we only
      // fetch the landing page once per parish instead of once per season.
      const sel = { ...selection('CboVenue', venue), ...selection('CboSeason', season) }
      const $teams = await client.post(SCHEDULES_URL, {
        ...formState($base), ...sel, ...imageButton('ctl00$article$BtnGo')
      })
      const rows = teamRows($teams)
      if (!rows.length) { vlog(`${season.label}: none`); continue }
      log(`   ${season.label}: ${rows.length} team(s)`)

      for (const row of rows) {
        const id = teamKey(season.label, row.league, row.division, row.name)
        const team = {
          id,
          org: org.key,
          orgName: org.short,
          season: season.label,
          seasonId: season.value,
          name: row.name,
          parish: row.parish,
          league: row.league,
          division: row.division,
          coaches: row.coaches,
          gameIds: []
        }
        const $sched = await client.post(SCHEDULES_URL, {
          ...formState($teams), ...sel, ...imageButton(row.button)
        })
        for (const g of parseSchedule($sched, team)) {
          // The same fixture appears on both opponents' pages; keep one copy.
          const existing = games.get(g.id)
          if (existing) existing.teamIds.push(id)
          else games.set(g.id, { ...g, season: season.label, teamIds: [id] })
          team.gameIds.push(g.id)
        }
        vlog(`${row.name} / ${row.league} ${row.division}: ${team.gameIds.length} games`)
        teams.push(team)
      }
    }
  }
  return { teams, games: [...games.values()] }
}

async function scrapeStandings (client, teams) {
  // Only pull the leagues our teams actually play in.
  const wanted = new Map()
  for (const t of teams) {
    if (!t.league) continue
    const k = `${t.season}|${t.league}`
    if (!wanted.has(k)) wanted.set(k, { season: t.season, league: t.league })
  }
  if (!wanted.size) return []

  const $base = await client.get(STANDINGS_URL)
  const seasons = comboOptions($base, 'CboSeason')
  const bySeason = new Map()
  for (const { season, league } of wanted.values()) {
    if (!bySeason.has(season)) bySeason.set(season, [])
    bySeason.get(season).push(league)
  }

  const out = []
  log('\n== standings')
  for (const [seasonLabel, leagues] of bySeason) {
    const season = seasons.find(s => s.label === seasonLabel)
    if (!season) continue
    // The league dropdown is cascading: changing the season repopulates it.
    const $withLeagues = await client.post(STANDINGS_URL, {
      ...formState($base),
      __EVENTTARGET: 'ctl00$article$CboSeason',
      ...selection('CboSeason', season),
      ...selection('CboVenue', { label: '', value: '' })
    })
    const options = comboOptions($withLeagues, 'CboVenue')

    for (const leagueName of leagues) {
      const league = options.find(o => o.label.trim() === leagueName.trim())
      if (!league) { log(`   ! league "${leagueName}" not listed for ${seasonLabel}`); continue }
      const $s = await client.post(STANDINGS_URL, {
        ...formState($withLeagues),
        ...selection('CboSeason', season),
        ...selection('CboVenue', league),
        ...imageButton('ctl00$article$BtnGo')
      })
      let division = null
      const rows = []
      for (const cells of gridRows($s, 'ctl00_article_Grid_Teams_ctl00')) {
        const c = cells.filter(Boolean)
        if (!c.length) continue
        if (/^Team$/i.test(c[0])) continue
        if (c.length === 1) {
          if (/No Games/i.test(c[0])) continue
          division = c[0].replace(/^Division\s*/i, '').trim()
          continue
        }
        if (c.length >= 4) {
          rows.push({
            division,
            team: c[0],
            wins: Number(c[1]) || 0,
            losses: Number(c[2]) || 0,
            draws: Number(c[3]) || 0
          })
        }
      }
      log(`   ${seasonLabel} / ${leagueName}: ${rows.length} row(s)`)
      out.push({ season: seasonLabel, league: leagueName, rows })
    }
  }
  return out
}

/**
 * A bracket names its teams but not its league, and a parish fields the same
 * team name in several leagues ("OL Lourdes-Gold" plays 3/4 Mixed, 56 A and
 * Cadet A kickball). The tournament title states the league, so that is the
 * signal -- roster overlap alone is not, since a larger league table
 * coincidentally contains more of any bracket's parishes.
 */
function matchLeague (title, participants, teams) {
  const sport = sportInTitle(title)
  const year = /\b(20\d{2})\b/.exec(title)?.[1]
  const term = /\b(Fall|Spring|Winter)\b/i.exec(title)?.[1]
  const want = leagueKey(title)
  if (!sport || !want.level) return null

  const candidates = teams.filter(t => {
    if (sportOfSeason(t.season) !== sport) return false
    if (year && !t.season.includes(year)) return false
    // Without this a "Fall Kickball" bracket also matches the spring 3/4 team,
    // which carries the same name, sport, year and league level.
    if (term && !new RegExp(`\\b${term}\\b`, 'i').test(t.season)) return false
    const got = leagueKey(t.league)
    return got.level === want.level && got.tier === want.tier
  })
  if (!candidates.length) return null

  // Sanity check: the teams we are about to attach must actually be in the bracket.
  const names = new Set(participants)
  const present = candidates.filter(t => names.has(t.name))
  return present.length ? { season: present[0].season, league: present[0].league, teams: present } : null
}

/** Mirrors sportOf() on the site: "2026 Fall Girls Kickball" -> "Kickball". */
function sportOfSeason (season) {
  return season
    .replace(/^\d{4}(-\d{4})?\s+/, '')
    .replace(/^(Fall|Spring|Winter)\s+/, '')
    .replace(/\b(Boys|Girls|CO-ED|Co-Ed|High School|&)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || season
}

async function scrapeTournaments (client, teams) {
  log('\n== tournaments')
  const brackets = await fetchTournaments(client, { formState, log: vlog })
  const games = []

  for (const b of brackets) {
    const participants = [...new Set(b.games.flatMap(g => [g.team1.name, g.team2.name]))]
      .filter(n => n && !/^bye$/i.test(n))
    const match = matchLeague(b.title, participants, teams)
    if (!match) { vlog(`${b.title}: no team of ours -- skipping`); continue }

    const { season, league, teams: ours } = match
    const ourNames = new Set(ours.map(t => t.name))

    let kept = 0
    for (const g of b.games) {
      // Byes and not-yet-scheduled bracket slots are not fixtures.
      if (!g.date) continue
      if (/^bye$/i.test(g.team1.name) || /^bye$/i.test(g.team2.name)) continue
      if (!ourNames.has(g.team1.name) && !ourNames.has(g.team2.name)) continue

      const played = g.team1.score != null && g.team2.score != null
      const game = {
        date: g.date,
        startTime: g.startTime,
        endTime: null,
        venue: g.venue,
        status: played ? 'Played' : 'Paired',
        league,
        division: null,
        team1: { name: g.team1.name, score: g.team1.score },
        team2: { name: g.team2.name, score: g.team2.score },
        season,
        tournament: { name: b.title, round: g.round, host: b.host, notes: b.notes }
      }
      game.id = gameId(game)
      game.teamIds = ours
        .filter(t => t.name === g.team1.name || t.name === g.team2.name)
        .map(t => t.id)
      games.push(game)
      kept++
    }
    if (kept) log(`   ${b.title} -> ${season} / ${league}: ${kept} game(s)`)
  }
  return games
}

/** Rebuild snapshot.json from the archive on disk, without touching CYO. */
async function rebuild () {
  const archive = await readArchive(SEASONS_DIR)
  if (!archive.size) throw new Error(`no season files in ${SEASONS_DIR}`)
  let previous = {}
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'))
  } catch { /* first run */ }

  const all = [...archive.values()]
  const snapshot = {
    ...previous,
    seasons: [...archive.keys()].sort(),
    teams: all.flatMap(s => s.teams),
    standings: all.flatMap(s => s.standings),
    games: all.flatMap(s => s.games)
      .sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
  }
  // Anything still listed by CYO was refreshed on the last real run; without a
  // scrape we cannot tell what is retired, so keep the previous answer.
  snapshot.retiredSeasons = (previous.retiredSeasons ?? []).filter(s => archive.has(s))

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  log(`Rebuilt ${OUT} from ${archive.size} season file(s): ` +
      `${snapshot.teams.length} teams, ${snapshot.games.length} games`)
}

async function main () {
  if (process.argv.includes('--rebuild')) return rebuild()
  const started = Date.now()
  const client = new CyoClient({ delayMs: Number(process.env.CYO_DELAY_MS ?? 600), log: vlog })

  const { teams, games } = await scrapeSchedules(client)
  const standings = await scrapeStandings(client, teams)

  for (const g of await scrapeTournaments(client, teams)) {
    games.push(g)
    for (const id of g.teamIds) {
      const team = teams.find(t => t.id === id)
      if (team && !team.gameIds.includes(g.id)) team.gameIds.push(g.id)
    }
  }

  games.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))

  // A/V club broadcasts are a nice-to-have: never fail the run over them.
  // Without an API key the feed only exposes 15 uploads, so results are merged
  // into an archive that fills in over time rather than replacing it.
  let videos = []
  try {
    const previous = JSON.parse(await readFile(VIDEOS, 'utf8').catch(() => '[]'))
    const { videos: fresh, source } = await fetchVideos()
    const { merged, added } = mergeVideos(previous, fresh)
    videos = merged
    await writeFile(VIDEOS, JSON.stringify(merged, null, 2) + '\n')
    log(`\n== youtube (${source}): ${fresh.length} fetched, ${added} new, ${merged.length} archived`)
    if (source === 'rss' && !process.env.YOUTUBE_API_KEY) {
      log('   set YOUTUBE_API_KEY to backfill the channel\'s full history')
    }
  } catch (e) {
    log(`\n! youtube unavailable (${e.message}) -- continuing`)
    videos = JSON.parse(await readFile(VIDEOS, 'utf8').catch(() => '[]'))
  }

  // Refuse to overwrite good data with an empty scrape (site down, markup change).
  if (!teams.length) throw new Error('scrape produced zero teams -- refusing to write archive')

  // Resolve who hosted each game; the site and the iCal feeds both read this.
  const hostParish = venueResolver(
    games.flatMap(g => [parishOf(g.team1.name), parishOf(g.team2.name)]))
  let hosted = 0
  for (const g of games) {
    g.homeSide = homeSide(g, hostParish)
    if (g.homeSide) hosted++
  }
  log(`\n== venues: host resolved for ${hosted}/${games.length} games ` +
      `(${games.length - hosted} at neutral sites)`)

  const scrapedAt = new Date().toISOString()
  const archive = await readArchive(SEASONS_DIR)
  const fresh = groupBySeason(scrapedAt, { teams, games, standings })

  log('\n== archive')
  const merged = new Map(archive)
  const counts = { added: 0, updated: 0, unchanged: 0, kept: 0 }
  for (const [name, record] of fresh) {
    const { season, action, before, after } = mergeSeason(archive.get(name), record)
    merged.set(name, season)
    counts[action]++
    if (action === 'kept') {
      log(`   ! ${name}: scrape returned ${after} games vs ${before} archived -- keeping archive`)
    } else if (action !== 'unchanged') {
      log(`   ${action}: ${name} (${record.games.length} games)`)
    }
  }
  const untouched = [...archive.keys()].filter(k => !fresh.has(k))
  if (untouched.length) log(`   retained ${untouched.length} season(s) no longer listed by CYO`)

  await writeArchive(SEASONS_DIR, merged)

  // The site reads one merged file; the per-season archive is the source of
  // truth it is rebuilt from, so a season retired by CYO still ships.
  const all = [...merged.values()]
  const snapshot = {
    scrapedAt,
    source: SCHEDULES_URL,
    orgs: ORGS,
    channel: { url: CHANNEL_URL, streams: STREAMS_URL },
    seasons: [...merged.keys()].sort(),
    retiredSeasons: untouched.sort(),
    videos,
    teams: all.flatMap(s => s.teams),
    standings: all.flatMap(s => s.standings),
    games: all.flatMap(s => s.games)
      .sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n')

  log(`\nWrote ${merged.size} season file(s) + ${OUT}`)
  log(`archive holds ${snapshot.teams.length} teams, ${snapshot.games.length} games ` +
      `across ${merged.size} season(s)`)
  log(`this run: ${teams.length} teams, ${games.length} games, ${standings.length} standings tables ` +
      `(${counts.added} added, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.kept} kept)`)
  log(`${client.requests} requests, ${((Date.now() - started) / 1000).toFixed(0)}s`)
}

main().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })
