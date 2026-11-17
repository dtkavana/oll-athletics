#!/usr/bin/env node
/**
 * 2025-26 5/6 boys basketball Elo.
 *
 * Reads data/Basketball Games 2025-26.json and writes
 * data/ratings/2025-26-boys-basketball-56.json for the orphan
 * /2025-26/basketball page. The output stays outside data/seasons so the
 * daily scrape will not merge it into snapshot.json.
 *
 * That file has one squad per school. The squad is treated as the top 8 of
 * the school's 5/6 pool. Pool size is this year's 5/6 team count: programs
 * field about the same number of teams from one year to the next. A school
 * with no 5/6 team this year is estimated at one team. Every game in the
 * file counts: jams, the season, holiday games, and the postseason, in date
 * order. A close game moves the rating less than a blowout.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAMES = resolve(ROOT, 'data/Basketball Games 2025-26.json')
const CURRENT = resolve(ROOT, 'data/ratings/2026-27-boys-basketball.json')
const OUT = resolve(ROOT, 'data/ratings/2025-26-boys-basketball-56.json')

const K = 48
const ROSTER = 8
const CENTER = 1500
const PRIOR_HEAD_START = 325
const CLOSE_MARGIN = 5
const COMFORTABLE_MARGIN = 14
const CLOSE_WEIGHT = 1
const COMFORTABLE_WEIGHT = 1.25
const BLOWOUT_WEIGHT = 1.5

/** Games-file name -> school name on the 2026-27 board. */
const SCHOOL = {
  'OL Grace': 'OL Of Grace',
  'St. Simon': 'St. Simon',
  'St. Pius': 'St. Pius X',
  'Mount Carmel': 'Mount Carmel',
  'IHM': 'Immac. Heart',
  'St. Barnabas': 'St. Barnabas',
  'St. Thomas': 'St. Thomas Aquin.',
  'St. LDM': 'St. Louis de Mont.',
  'St. Luke': 'St. Luke',
  'Holy Spirit Geist': 'Holy Spirit Geist',
  'Christ the King': 'Christ the King',
  'St. Malachy': 'St. Malachy',
  'St. Matthew': 'St. Matthew',
  'St. Francis & Clare': 'Ss. Fran. & Clare',
  'St. Maria Goretti': 'St. Maria Gor.',
  'Nativity': 'Nativity',
  'St. Charles': 'St. Charles',
  'St. Jude': 'St. Jude',
  'St. Joan of Arc': 'St. Joan of Arc',
  'OLL': 'OL Lourdes',
  'St. Christopher': 'St. Christopher',
  'St. Roch': 'St. Roch',
  'Holy Name': 'Holy Name',
  'OL Greenwood': 'OL Greenwood',
  'St. Susanna': 'St. Susanna',
  'Little Flower': 'Little Flower',
  'St. Monica': 'St. Monica',
  'Holy Spirit Indy': 'Holy Spirit, Indy',
  'St. Michael Greenfield': 'St. Michael, Grnfld.',
  'St. Mark': 'St. Mark',
  'St. Rose': 'St. Rose',
  'St. Anthony': 'St. Anthony',
  'St. Philip': 'St. Philip'
}

const log = (...a) => console.error(...a)
const round1 = n => Math.round(n * 10) / 10

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

function orderMean (n, best, worst) {
  let sum = 0
  for (let k = best; k <= worst; k++) {
    const ascending = n - k + 1
    const p = (ascending - 0.375) / (n + 0.25)
    sum += normsInv(Math.min(1 - 1e-12, Math.max(1e-12, p)))
  }
  return sum / (worst - best + 1)
}

const ELO_PER_STRENGTH = PRIOR_HEAD_START / orderMean(32, 1, ROSTER)

/** Top squad of a pool with `teams` squads of 8. One team starts at 1500. */
function baselineFor (teams) {
  const pool = Math.max(1, teams) * ROSTER
  return CENTER + ELO_PER_STRENGTH * orderMean(pool, 1, ROSTER)
}

function resultWeight (scoreA, scoreB) {
  const margin = Math.abs(scoreA - scoreB)
  if (margin === 0) return CLOSE_WEIGHT
  if (margin <= CLOSE_MARGIN) return CLOSE_WEIGHT
  if (margin <= COMFORTABLE_MARGIN) return COMFORTABLE_WEIGHT
  return BLOWOUT_WEIGHT
}

function expectScore (ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400))
}

function parseDate (text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text || '')
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

function slug (name) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const current = JSON.parse(await readFile(CURRENT, 'utf8'))
const band = current.bands.find(b => b.id === '56')
if (!band) throw new Error('2026-27 ratings have no 5/6 band')
const teamsThisYear = new Map()
for (const team of band.rankings) {
  teamsThisYear.set(team.school, (teamsThisYear.get(team.school) || 0) + 1)
}

const pool = {}
for (const [name, school] of Object.entries(SCHOOL)) {
  const count = teamsThisYear.get(school) || 0
  pool[name] = {
    school,
    teams: count || 1,
    estimated: count === 0
  }
  if (!count) log(`${name}: no 5/6 team in 2026-27, estimating 1`)
}

const raw = JSON.parse(await readFile(GAMES, 'utf8'))
if (!Array.isArray(raw)) throw new Error('games file is not an array')

const seen = new Set()
const games = []
for (const [index, row] of raw.entries()) {
  const a = row['Team 1']
  const b = row['Team 2']
  const sa = row['T1 Score']
  const sb = row['T2 Score']
  const parsed = parseDate(row.Date)
  // Blank dates and "Final …" labels sit in the postseason block. Keep file order.
  const date = parsed ?? '9999-12-31'
  const dated = Boolean(parsed)
  if (!a || !b || !Number.isFinite(sa) || !Number.isFinite(sb)) {
    throw new Error(`bad game at index ${index}: ${JSON.stringify(row)}`)
  }
  if (!(a in SCHOOL)) throw new Error(`no 2026-27 school for ${a}`)
  if (!(b in SCHOOL)) throw new Error(`no 2026-27 school for ${b}`)
  seen.add(a)
  seen.add(b)
  games.push({ index, date, dated, type: row.Type || '', a, b, sa, sb })
}

const missing = Object.keys(SCHOOL).filter(name => !seen.has(name))
if (missing.length) throw new Error(`school with no games: ${missing.join(', ')}`)

games.sort((x, y) => x.date.localeCompare(y.date) || x.index - y.index)

const STARTS = Object.fromEntries(Object.keys(SCHOOL).map(name => [name, baselineFor(pool[name].teams)]))
const rating = Object.fromEntries(Object.entries(STARTS))
const record = Object.fromEntries(Object.keys(SCHOOL).map(name => [name, { w: 0, l: 0, t: 0, games: 0, opponents: [] }]))
const byType = {}

for (const g of games) {
  const ra = rating[g.a]
  const rb = rating[g.b]
  const weight = resultWeight(g.sa, g.sb)
  const expectedA = expectScore(ra, rb)
  let actualA
  if (g.sa > g.sb) actualA = 1
  else if (g.sa < g.sb) actualA = 0
  else actualA = 0.5
  const delta = K * weight * (actualA - expectedA)
  rating[g.a] = ra + delta
  rating[g.b] = rb - delta
  record[g.a].games++
  record[g.b].games++
  record[g.a].opponents.push(g.b)
  record[g.b].opponents.push(g.a)
  if (g.sa > g.sb) {
    record[g.a].w++
    record[g.b].l++
  } else if (g.sa < g.sb) {
    record[g.b].w++
    record[g.a].l++
  } else {
    record[g.a].t++
    record[g.b].t++
  }
  byType[g.type] = (byType[g.type] || 0) + 1
}

const rankings = Object.keys(SCHOOL)
  .map(name => {
    const rec = record[name]
    const ties = rec.t ? `-${rec.t}` : ''
    return {
      id: slug(name),
      school: name === 'OLL' ? 'OL Lourdes' : name,
      name,
      teams: pool[name].teams,
      pool: pool[name].teams * ROSTER,
      baseline: round1(STARTS[name]),
      rating: round1(rating[name]),
      delta: round1(rating[name] - STARTS[name]),
      wins: rec.w,
      losses: rec.l,
      ties: rec.t,
      games: rec.games,
      record: `${rec.w}-${rec.l}${ties}`,
      sos: rec.opponents.length
        ? round1(rec.opponents.reduce((sum, opponent) => sum + rating[opponent], 0) / rec.opponents.length)
        : null
    }
  })
  .sort((x, y) => y.rating - x.rating || x.name.localeCompare(y.name))
  .map((team, i) => ({ ...team, rank: i + 1 }))

const evenClose = K * CLOSE_WEIGHT * 0.5
const evenComfortable = K * COMFORTABLE_WEIGHT * 0.5
const evenBlowout = K * BLOWOUT_WEIGHT * 0.5

const out = {
  generatedAt: new Date().toISOString(),
  season: '2025-26 5th / 6th Boys Basketball',
  model: {
    k: K,
    closeMargin: CLOSE_MARGIN,
    comfortableMargin: COMFORTABLE_MARGIN,
    rosterSize: ROSTER,
    priorHeadStart: PRIOR_HEAD_START,
    pool: 'The 2025-26 squad is the top 8 of that school\'s 5/6 pool. The pool is 8 times how many 5/6 teams the school fields in 2026-27.',
    scale: 'A one-team school starts at 1500. The best 8 of a 32-boy pool start 325 points higher.',
    update: `A game decided by ${CLOSE_MARGIN} points or fewer is ±${evenClose} between even teams. A margin of ${CLOSE_MARGIN + 1} to ${COMFORTABLE_MARGIN} is ±${evenComfortable}. A margin of ${COMFORTABLE_MARGIN + 1} or more is ±${evenBlowout}. Jams, holiday games, the season, and the postseason all count.`,
    sos: 'SOS is the average final rating of the opponents played.'
  },
  summary: {
    teams: rankings.length,
    games: games.length,
    undatedGames: games.filter(g => !g.dated).length,
    byType
  },
  rankings
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')

const undated = games.filter(g => !g.dated).length
log(`${rankings.length} teams, ${games.length} games, ${undated} kept in file order`)
log(byType)
for (const team of [...rankings].sort((a, b) => b.teams - a.teams || a.name.localeCompare(b.name))) {
  log(`${team.name}: ${team.teams} team(s), start ${team.baseline}, rating ${team.rating} ${team.record}`)
}
log('---')
for (const team of rankings.slice(0, 8)) {
  log(`#${team.rank} ${team.name} ${team.record} ${team.rating} (start ${team.baseline})`)
}
const oll = rankings.find(t => t.name === 'OLL')
log(`OLL #${oll.rank} ${oll.record} ${oll.rating} (start ${oll.baseline})`)
