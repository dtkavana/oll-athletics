export interface PlayerLine {
  num: string
  name: string
  gs: boolean
  min: string
  pts: number
  reb: number
  ast: number
  pf: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  stl: number
  blk: number
  to: number
  pm: number
}

export interface StatsGame {
  id: string
  date: string
  startTime: string | null
  venue: string | null
  opponent: string
  site: 'home' | 'away' | 'neutral'
  oll: number | null
  opp: number | null
  players?: PlayerLine[]
  /** Court pixels: x from the left sideline, y down from the baseline. */
  shots?: ShotMark[]
}

export interface ShotMark {
  num: string
  x: number
  y: number
  made: boolean
}

export interface StatsFile {
  season: string
  league: string
  division: string
  team: string
  coach: string
  games: StatsGame[]
}

const COUNT_KEYS = ['pts', 'reb', 'ast', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'stl', 'blk', 'to', 'pm'] as const

export function toSec (min: string) {
  const [m, s] = min.split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}

export function formatMin (sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function shotPct (made: number, att: number) {
  if (att <= 0) return '—'
  return (Math.round((1000 * made) / att) / 10).toFixed(1)
}

export function formatPm (n: number | null) {
  if (n == null) return ''
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * OLL Game Score, provisionally calibrated to a 0.75-point Cadet A possession.
 * The non-scoring weights are the CraftedNBA model scaled to that baseline.
 */
export const OLL_GAME_SCORE_WEIGHTS = {
  pts: 1,
  fga: -0.55,
  fta: -0.35,
  ftm: 0.15,
  to: -0.8,
  oreb: 0.55,
  dreb: 0.3,
  ast: 0.5,
  stl: 1,
  blk: 0.6,
  pf: -0.3
} as const

type GameScoreLine = Pick<PlayerLine, keyof typeof OLL_GAME_SCORE_WEIGHTS>

export function ollGameScore (line: GameScoreLine) {
  return Object.entries(OLL_GAME_SCORE_WEIGHTS)
    .reduce((score, [key, weight]) => score + line[key as keyof GameScoreLine] * weight, 0)
}

export function formatGameScore (line: GameScoreLine, games = 1) {
  const score = ollGameScore(line) / Math.max(games, 1)
  return (Math.round((score + Number.EPSILON) * 10) / 10).toFixed(1)
}

export interface SeasonLine extends PlayerLine {
  gp: number
  starts: number
}

export function seasonLines (games: StatsGame[]): SeasonLine[] {
  const map = new Map<string, SeasonLine & { sec: number }>()
  for (const game of games) {
    for (const p of game.players ?? []) {
      const key = `${p.num}|${p.name}`
      let row = map.get(key)
      if (!row) {
        row = { ...p, gp: 0, starts: 0, sec: 0, pm: 0, pts: 0, reb: 0, ast: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, min: '0:00' }
        map.set(key, row)
      }
      row.gp += 1
      if (p.gs) row.starts += 1
      row.sec += toSec(p.min)
      for (const k of COUNT_KEYS) row[k] += p[k]
    }
  }
  return [...map.values()]
    .map(row => ({ ...row, min: formatMin(row.sec) }))
    .sort((a, b) => b.pts - a.pts || b.sec - a.sec || a.name.localeCompare(b.name))
}

export function hasBox (game: StatsGame) {
  return (game.players?.length ?? 0) > 0
}

export function resultOf (game: StatsGame) {
  if (game.oll == null || game.opp == null) return null
  const result = game.oll > game.opp ? 'W' : game.oll < game.opp ? 'L' : 'T'
  return { result, oll: game.oll, opp: game.opp }
}

export const TEAM_STATS = '/ratings/basketball/cadet/oll'
