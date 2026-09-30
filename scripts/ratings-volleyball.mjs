#!/usr/bin/env node
/**
 * Girls volleyball depth-prior Elo, 4th grade through Cadet.
 *
 * Writes data/ratings/2026-fall-girls-volleyball.json, which the orphan
 * /2026/volleyball page reads. The file is outside data/seasons, so the
 * daily scrape will not merge it into snapshot.json. Pools are per grade:
 * a school's 4th-grade teams are a separate pool from its 5/6 and Cadet teams.
 *
 * Baseline: every team is 8 girls drawn from one shared talent distribution.
 * A school's pool is (its 5/6 teams) × 8. A teams take the top of that pool,
 * then B, then C. Teams in the same letter share a slice and start equal.
 * That gap is compressed: the best 8 of 32 start 100 points above a one-team
 * school. A 7-8 game season then outweighs the start. A 2-0 counts more than
 * a 2-1, and a 0-2 costs more than a 1-2.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CyoClient, SCHEDULES_URL, STANDINGS_URL,
  formState, comboOptions, selection, imageButton, gridRows
} from './lib/cyo.mjs'
import { parseTeamCell, parseInfoCell, isMonthHeader, isEmptyNotice, gameId, slug } from './lib/parse.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'data/ratings/2026-fall-girls-volleyball.json')

const BANDS = [
  { id: '4th', label: '4th Grade' },
  { id: '56', label: '5th / 6th' },
  { id: 'Cadet', label: 'Cadet' }
]

const SEASON = '2026 Fall Girls Volleyball'
const ROSTER = 8
const CENTER = 1500
// Short season: 7-8 games, then the tournament. One even 2-1 is ±24 points
// and one even 2-0 is ±36, so the record can pass the starting gap by tourney time.
const K = 48
const SWEEP_WEIGHT = 1.5
const CLOSE_WEIGHT = 1
// Best 8 of a 32-girl pool (four teams) start this far above a one-team school.
// Every other slice uses the same scale, so the shape of the pool stays and the size does not.
const PRIOR_HEAD_START = 100

const log = (...a) => console.error(...a)

/** Acklam's inverse standard normal. p in (0, 1). */
function normsInv (p) {
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
  ]
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01
  ]
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.491873125091786e+00, 3.754408661907416e+00, 2.938163982698783e+00
  ]
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00
  ]
  const plow = 0.02425
  const phigh = 1 - plow
  let q
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  q = p - 0.5
  const r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/**
 * Expected ability of the k-th best girl in a pool of n (k = 1 is best).
 * Blom plotting position, alpha = 0.375.
 */
function expectedOrder (n, k) {
  const ascending = n - k + 1
  const p = (ascending - 0.375) / (n + 0.25)
  return normsInv(Math.min(1 - 1e-12, Math.max(1e-12, p)))
}

/** Mean expected ability across ranks best..worst (1 = best). */
function orderMean (n, best, worst) {
  let sum = 0
  for (let k = best; k <= worst; k++) sum += expectedOrder(n, k)
  return sum / (worst - best + 1)
}

const ELO_PER_STRENGTH = PRIOR_HEAD_START / orderMean(32, 1, ROSTER)

/** 2-0 (or 0-2) moves the rating more than 2-1 (or 1-2). */
function resultWeight (scoreA, scoreB) {
  return Math.abs(scoreA - scoreB) >= 2 ? SWEEP_WEIGHT : CLOSE_WEIGHT
}

function assertModel () {
  const mid = normsInv(0.5)
  const tail = normsInv(0.975)
  if (Math.abs(mid) > 1e-6) throw new Error(`normsInv(0.5) = ${mid}`)
  if (Math.abs(tail - 1.95996398454) > 1e-4) throw new Error(`normsInv(0.975) = ${tail}`)
  const all = orderMean(ROSTER, 1, ROSTER)
  if (Math.abs(all) > 0.03) throw new Error(`full-pool mean ${all} is not ~0`)
  const top = orderMean(32, 1, ROSTER)
  if (top < 1 || top > 1.6) throw new Error(`top-8-of-32 mean ${top} is out of range`)
  const head = ELO_PER_STRENGTH * top
  if (Math.abs(head - PRIOR_HEAD_START) > 0.01) throw new Error(`head start ${head}`)
}

const round1 = n => Math.round(n * 10) / 10
const round4 = n => Math.round(n * 10000) / 10000

function schoolOf (name) {
  const i = name.lastIndexOf('-')
  return i <= 0 ? name : name.slice(0, i)
}

function colorOf (name) {
  const i = name.lastIndexOf('-')
  return i <= 0 ? '' : name.slice(i + 1)
}

function gradeBand (league) {
  const t = (league || '').trim()
  if (!/Girls$/i.test(t)) return null
  if (/^4th\b/i.test(t)) return '4th'
  if (/^56\b/.test(t)) return '56'
  if (/^Cadet\b/i.test(t)) return 'Cadet'
  return null
}

function tierOf (league) {
  const m = /^(?:4th|56|Cadet)\s+([A-Z])\b/i.exec((league || '').trim())
  return m ? m[1].toUpperCase() : null
}

const isBye = name => /bye/i.test(name || '')
const teamKey = (league, name) => `${league}||${name}`

function expectScore (ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400))
}

function teamRows ($) {
  const out = []
  $('#ctl00_article_Grid_Teams_ctl00 tr').each((_, tr) => {
    const $tr = $(tr)
    const cells = $tr.find('td').map((__, td) =>
      $(td).text().replace(/\s+/g, ' ').replace(/ /g, ' ').trim()).get()
    const button = $tr.find('input[name*="gbccolumn"]').attr('name')
    if (button && cells.length >= 4) {
      out.push({
        name: cells[0],
        parish: cells[1],
        league: cells[2],
        division: cells[3],
        button
      })
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
      venue: info.venue,
      status: info.status,
      league: (t1.league ?? team.league).trim(),
      division: t1.division ?? team.division,
      team1: { name: t1.name, score: t1.score },
      team2: { name: t2.name, score: t2.score }
    }
    g.id = gameId(g)
    games.push(g)
  }
  return games
}

function ensureTeam (teams, league, name, extra = {}) {
  const band = gradeBand(league)
  if (!name || isBye(name) || !band) return null
  const key = teamKey(league, name)
  let team = teams.get(key)
  if (!team) {
    team = {
      key,
      id: `${slug(league)}--${slug(name)}`,
      name,
      school: schoolOf(name),
      color: colorOf(name),
      league,
      band,
      tier: tierOf(league),
      division: extra.division ?? null,
      parish: extra.parish ?? null
    }
    teams.set(key, team)
  } else {
    if (extra.division && !team.division) team.division = extra.division
    if (extra.parish && !team.parish) team.parish = extra.parish
  }
  return team
}

async function scrapeSchedules (client) {
  const $base = await client.get(SCHEDULES_URL)
  const seasons = comboOptions($base, 'CboSeason')
  const venues = comboOptions($base, 'CboVenue')
  const season = seasons.find(s => s.label === SEASON)
  if (!season) throw new Error(`season "${SEASON}" is not listed`)

  const teams = new Map()
  const games = new Map()
  const errors = []

  for (const venue of venues) {
    if (!venue.label || !venue.value) continue
    let $teams
    try {
      $teams = await client.post(SCHEDULES_URL, {
        ...formState($base),
        ...selection('CboVenue', venue),
        ...selection('CboSeason', season),
        ...imageButton('ctl00$article$BtnGo')
      })
    } catch (e) {
      errors.push(`${venue.label}: ${e.message}`)
      log(`! ${venue.label}: ${e.message}`)
      continue
    }
    const rows = teamRows($teams).filter(r => gradeBand(r.league) && !isBye(r.name))
    if (!rows.length) continue
    log(`  ${venue.label}: ${rows.length} team(s)`)

    for (const row of rows) {
      ensureTeam(teams, row.league, row.name, row)
      let $sched
      try {
        $sched = await client.post(SCHEDULES_URL, {
          ...formState($teams),
          ...selection('CboVenue', venue),
          ...selection('CboSeason', season),
          ...imageButton(row.button)
        })
      } catch (e) {
        errors.push(`${row.name} / ${row.league}: ${e.message}`)
        log(`! ${row.name} / ${row.league}: ${e.message}`)
        continue
      }
      for (const g of parseSchedule($sched, row)) {
        if (!gradeBand(g.league)) continue
        const existing = games.get(g.id)
        if (!existing) games.set(g.id, g)
        else if (existing.team1.score == null && g.team1.score != null) games.set(g.id, g)
      }
    }
  }
  return { teams, games: [...games.values()], errors }
}

async function scrapeStandings (client) {
  const $base = await client.get(STANDINGS_URL)
  const seasons = comboOptions($base, 'CboSeason')
  const season = seasons.find(s => s.label === SEASON)
  if (!season) return []
  const $withLeagues = await client.post(STANDINGS_URL, {
    ...formState($base),
    __EVENTTARGET: 'ctl00$article$CboSeason',
    ...selection('CboSeason', season),
    ...selection('CboVenue', { label: '', value: '' })
  })
  const leagues = comboOptions($withLeagues, 'CboVenue')
    .filter(o => gradeBand(o.label))

  const rows = []
  for (const league of leagues) {
    const $s = await client.post(STANDINGS_URL, {
      ...formState($withLeagues),
      ...selection('CboSeason', season),
      ...selection('CboVenue', league),
      ...imageButton('ctl00$article$BtnGo')
    })
    let division = null
    for (const cells of gridRows($s, 'ctl00_article_Grid_Teams_ctl00')) {
      const c = cells.filter(Boolean)
      if (!c.length || /^Team$/i.test(c[0])) continue
      if (c.length === 1) {
        if (/No Games/i.test(c[0])) continue
        division = c[0].replace(/^Division\s*/i, '').trim()
        continue
      }
      if (c.length >= 4) {
        rows.push({
          league: league.label.trim(),
          division,
          team: c[0],
          wins: Number(c[1]) || 0,
          losses: Number(c[2]) || 0,
          draws: Number(c[3]) || 0
        })
      }
    }
    log(`  standings ${league.label.trim()}: ${rows.filter(r => r.league === league.label.trim()).length}`)
  }
  return rows
}

function assignBaselines (teams) {
  const bySchool = new Map()
  for (const team of teams.values()) {
    const key = `${team.band}||${team.school}`
    if (!bySchool.has(key)) bySchool.set(key, [])
    bySchool.get(key).push(team)
  }
  for (const group of bySchool.values()) {
    const n = group.length * ROSTER
    const tiers = [...new Set(group.map(t => t.tier))].sort((a, b) => {
      if (a === b) return 0
      if (a == null) return 1
      if (b == null) return -1
      return a.localeCompare(b)
    })
    let taken = 0
    for (const tier of tiers) {
      const slice = group.filter(t => t.tier === tier)
      const width = slice.length * ROSTER
      const best = taken + 1
      const worst = taken + width
      const strength = orderMean(n, best, worst)
      for (const team of slice) {
        team.pool = n
        team.schoolTeams = group.length
        team.slice = { best, worst }
        team.strength = strength
        team.baseline = CENTER + ELO_PER_STRENGTH * strength
        team.rating = team.baseline
        team.wins = 0
        team.losses = 0
        team.draws = 0
        team.opponents = []
      }
      taken = worst
    }
  }
}

function applyResults (teams, games) {
  const played = games
    .filter(g => g.team1.score != null && g.team2.score != null)
    .filter(g => !isBye(g.team1.name) && !isBye(g.team2.name))
    .sort((a, b) => (a.date + (a.startTime ?? '') + a.id).localeCompare(b.date + (b.startTime ?? '') + b.id))

  const byId = new Map([...teams.values()].map(t => [t.id, t]))
  const logGames = []
  const skipped = []
  for (const g of played) {
    const a = (g.team1.id && byId.get(g.team1.id)) || teams.get(teamKey(g.league, g.team1.name))
    const b = (g.team2.id && byId.get(g.team2.id)) || teams.get(teamKey(g.league, g.team2.name))
    if (!a || !b) {
      skipped.push({ id: g.id, league: g.league, team1: g.team1.name ?? g.team1.id, team2: g.team2.name ?? g.team2.id })
      continue
    }
    const beforeA = a.rating
    const beforeB = b.rating
    const ea = expectScore(beforeA, beforeB)
    let sa
    if (g.team1.score > g.team2.score) sa = 1
    else if (g.team1.score < g.team2.score) sa = 0
    else sa = 0.5
    const weight = sa === 0.5 ? 1 : resultWeight(g.team1.score, g.team2.score)
    const k = K * weight
    a.rating = beforeA + k * (sa - ea)
    b.rating = beforeB + k * ((1 - sa) - (1 - ea))
    if (sa === 1) { a.wins++; b.losses++ }
    else if (sa === 0) { a.losses++; b.wins++ }
    else { a.draws++; b.draws++ }
    a.opponents.push(b)
    b.opponents.push(a)
    logGames.push({
      id: g.id,
      date: g.date,
      startTime: g.startTime,
      league: g.league,
      division: g.division,
      team1: a.id,
      team2: b.id,
      score1: g.team1.score,
      score2: g.team2.score,
      weight,
      rating1Before: round1(beforeA),
      rating2Before: round1(beforeB),
      rating1After: round1(a.rating),
      rating2After: round1(b.rating)
    })
  }
  return { logGames, skipped }
}

function record (team) {
  const base = `${team.wins}-${team.losses}`
  return team.draws ? `${base}-${team.draws}` : base
}

function publishTeam (team) {
  return {
    id: team.id,
    band: team.band,
    school: team.school,
    name: team.name,
    league: team.league,
    tier: team.tier,
    division: team.division,
    pool: team.pool,
    baseline: round1(team.baseline),
    rating: round1(team.rating),
    delta: round1(team.rating - team.baseline),
    wins: team.wins,
    losses: team.losses,
    record: record(team),
    sos: scheduleStrength(team)
  }
}

function scheduleStrength (team) {
  const played = team.opponents ?? []
  if (!played.length) return null
  const avg = played.reduce((sum, opponent) => sum + opponent.rating, 0) / played.length
  return round1(avg)
}

function buildFile ({ teams, logGames, skipped, standings, errors }) {
  const list = [...teams.values()].map(publishTeam)
  const mismatches = []
  for (const row of standings) {
    if (isBye(row.team)) continue
    const team = teams.get(teamKey(row.league, row.team))
    if (!team) {
      mismatches.push({ team: row.team, league: row.league, issue: 'in standings, no schedule' })
      continue
    }
    if (team.wins !== row.wins || team.losses !== row.losses || team.draws !== row.draws) {
      mismatches.push({
        team: row.team,
        league: row.league,
        games: record(team),
        standings: `${row.wins}-${row.losses}${row.draws ? '-' + row.draws : ''}`
      })
    }
  }

  const bands = BANDS.map(band => {
    const rankings = list
      .filter(t => t.band === band.id)
      .sort((a, b) => b.rating - a.rating || a.school.localeCompare(b.school) || a.name.localeCompare(b.name))
    rankings.forEach((team, i) => { team.rank = i + 1 })
    return {
      id: band.id,
      label: band.label,
      leagues: [...new Set(rankings.map(t => t.league))].sort(),
      teams: rankings.length,
      games: logGames.filter(g => gradeBand(g.league) === band.id).length,
      rankings
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    season: SEASON,
    model: {
      rosterSize: ROSTER,
      center: CENTER,
      k: K,
      sweepWeight: SWEEP_WEIGHT,
      priorHeadStart: PRIOR_HEAD_START,
      pool: 'Within one grade, pool = (teams that school fields in that grade) × 8. 4th grade, 5/6, and Cadet are separate pools.',
      slices: 'Where a grade has A, B, and C, A takes the top of the pool, then B, then C. Teams in the same letter start equal. A grade with no letter starts every team at 1500.',
      scale: 'A one-team school starts at 1500. The best 8 of a 32-girl pool start 100 points higher.',
      update: 'A 2-1 between even teams is ±24 points. A 2-0 is ±36.',
      sos: 'SOS is the average final rating of the opponents played.'
    },
    summary: {
      teams: list.length,
      games: logGames.length,
      skippedGames: skipped.length,
      standingsMismatches: mismatches.length,
      scheduleErrors: errors.length
    },
    bands,
    checks: { standingsMismatches: mismatches, skippedGames: skipped, scheduleErrors: errors }
  }
}

async function main () {
  assertModel()
  const started = Date.now()
  const client = new CyoClient({ delayMs: Number(process.env.CYO_DELAY_MS ?? 500), log: () => {} })
  log(`schedules for ${SEASON}`)
  const { teams, games, errors } = await scrapeSchedules(client)
  log(`standings`)
  const standings = await scrapeStandings(client)
  for (const row of standings) ensureTeam(teams, row.league, row.team, { division: row.division })

  assignBaselines(teams)
  const { logGames, skipped } = applyResults(teams, games)
  const file = buildFile({ teams, logGames, skipped, standings, errors })

  for (const band of file.bands) {
    if (band.teams < 8) throw new Error(`${band.label} has only ${band.teams} teams — refusing to write`)
  }
  if (file.summary.games < 40) {
    throw new Error(`only ${file.summary.games} played games — refusing to write`)
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(file, null, 2) + '\n')
  log(`\n${file.summary.teams} teams, ${file.summary.games} games`)
  log(`standings mismatches: ${file.summary.standingsMismatches}, skipped: ${file.summary.skippedGames}, errors: ${file.summary.scheduleErrors}`)
  log(`wrote ${OUT}`)
  log(`${client.requests} requests, ${((Date.now() - started) / 1000).toFixed(0)}s`)
  for (const band of file.bands) {
    log(`  ${band.label}: ${band.teams} teams, ${band.games} games, leagues ${band.leagues.join(', ')}`)
    for (const team of band.rankings.slice(0, 3)) {
      log(`    ${team.rank} ${team.name} ${team.league} ${team.record} ${team.rating}`)
    }
  }
}

main().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })
