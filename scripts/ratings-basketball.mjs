#!/usr/bin/env node
/**
 * 2025-26 5/6 boys basketball Elo.
 *
 * Reads data/Basketball Games 2025-26.json and writes
 * data/ratings/2025-26-boys-basketball-56.json for the orphan
 * /2025-26/basketball page. The output stays outside data/seasons so the
 * daily scrape will not merge it into snapshot.json.
 *
 * Starting ratings are assigned by school. Every game in the file counts:
 * jams, the season, holiday games, and the postseason, in date order.
 * A close game moves the rating less than a blowout.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAMES = resolve(ROOT, 'data/Basketball Games 2025-26.json')
const OUT = resolve(ROOT, 'data/ratings/2025-26-boys-basketball-56.json')

const K = 48
const CLOSE_MARGIN = 5
const COMFORTABLE_MARGIN = 14
const CLOSE_WEIGHT = 1
const COMFORTABLE_WEIGHT = 1.25
const BLOWOUT_WEIGHT = 1.5

/** School name in the games file -> starting Elo. */
const STARTS = {
  'OL Grace': 1600,
  'St. Simon': 1600,
  'St. Pius': 1600,
  'Mount Carmel': 1600,
  'IHM': 1600,
  'St. Barnabas': 1575,
  'St. Thomas': 1575,
  'St. LDM': 1550,
  'St. Luke': 1550,
  'Holy Spirit Geist': 1550,
  'Christ the King': 1450,
  'St. Malachy': 1550,
  'St. Matthew': 1525,
  'St. Francis & Clare': 1525,
  'St. Maria Goretti': 1525,
  'Nativity': 1525,
  'St. Charles': 1450,
  'St. Jude': 1450,
  'St. Joan of Arc': 1450,
  'OLL': 1450,
  'St. Christopher': 1450,
  'St. Roch': 1450,
  'Holy Name': 1450,
  'OL Greenwood': 1300,
  'St. Susanna': 1300,
  'Little Flower': 1250,
  'St. Monica': 1200,
  'Holy Spirit Indy': 1200,
  'St. Michael Greenfield': 1100,
  'St. Mark': 1100,
  'St. Rose': 1100,
  'St. Anthony': 1100,
  'St. Philip': 1100
}

const log = (...a) => console.error(...a)
const round1 = n => Math.round(n * 10) / 10

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
  if (!(a in STARTS)) throw new Error(`no starting Elo for ${a}`)
  if (!(b in STARTS)) throw new Error(`no starting Elo for ${b}`)
  seen.add(a)
  seen.add(b)
  games.push({ index, date, dated, type: row.Type || '', a, b, sa, sb })
}

const missing = Object.keys(STARTS).filter(name => !seen.has(name))
if (missing.length) throw new Error(`starting Elo with no games: ${missing.join(', ')}`)

games.sort((x, y) => x.date.localeCompare(y.date) || x.index - y.index)

const rating = Object.fromEntries(Object.entries(STARTS).map(([name, start]) => [name, start]))
const record = Object.fromEntries(Object.keys(STARTS).map(name => [name, { w: 0, l: 0, t: 0, games: 0, opponents: [] }]))
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

const rankings = Object.keys(STARTS)
  .map(name => {
    const rec = record[name]
    const ties = rec.t ? `-${rec.t}` : ''
    return {
      id: slug(name),
      school: name === 'OLL' ? 'OL Lourdes' : name,
      name,
      baseline: STARTS[name],
      rating: round1(rating[name]),
      delta: round1(rating[name] - STARTS[name]),
      wins: rec.w,
      losses: rec.l,
      ties: rec.t,
      games: rec.games,
      record: `${rec.w}-${rec.l}${ties}`,
      sos: rec.opponents.length
        ? round1(rec.opponents.reduce((sum, name) => sum + rating[name], 0) / rec.opponents.length)
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
    scale: 'Each school starts at its assigned 2025-26 rating, from 1100 to 1600.',
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
for (const team of rankings.slice(0, 8)) {
  log(`#${team.rank} ${team.name} ${team.record} ${team.rating} (start ${team.baseline})`)
}
const oll = rankings.find(t => t.name === 'OLL')
log(`OLL #${oll.rank} ${oll.record} ${oll.rating} (start ${oll.baseline})`)
