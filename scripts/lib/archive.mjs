/**
 * Per-season archive.
 *
 * CYO's dropdowns only ever expose a rolling window of seasons, so a scrape is
 * a snapshot of what is *currently* published, not of everything that happened.
 * Writing that straight over the data file would quietly drop a season the day
 * CYO stops listing it.
 *
 * So each season is its own file under data/seasons/. A scrape refreshes the
 * seasons it saw and leaves every other file untouched, which means the archive
 * only ever grows. Git history on top of that gives a trail of score
 * corrections.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { slug } from './parse.mjs'

export const seasonFile = season => `${slug(season)}.json`

export async function readArchive (dir) {
  const seasons = new Map()
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return seasons // first run
  }
  for (const name of names.filter(n => n.endsWith('.json'))) {
    try {
      const data = JSON.parse(await readFile(join(dir, name), 'utf8'))
      if (data.season) seasons.set(data.season, data)
    } catch (e) {
      throw new Error(`archive file ${name} is unreadable: ${e.message}`)
    }
  }
  return seasons
}

/** Group a flat scrape into one record per season. */
export function groupBySeason (scrapedAt, { teams, games, standings }) {
  const out = new Map()
  const bucket = season => {
    if (!out.has(season)) {
      out.set(season, { season, scrapedAt, teams: [], games: [], standings: [] })
    }
    return out.get(season)
  }
  for (const t of teams) bucket(t.season).teams.push(t)
  for (const g of games) bucket(g.season).games.push(g)
  for (const s of standings) bucket(s.season).standings.push(s)
  return out
}

/**
 * A partial scrape (CYO half-down, markup drift) can return a season with most
 * of its games missing. Losing a couple to a cancellation is normal; losing a
 * fifth of them is not, and an archive should not shrink on a bad day.
 */
const SHRINK_LIMIT = 0.8

export function mergeSeason (existing, fresh) {
  if (!existing) return { season: fresh, action: 'added' }
  const before = existing.games?.length ?? 0
  const after = fresh.games.length
  if (before && after < before * SHRINK_LIMIT) {
    return { season: existing, action: 'kept', before, after }
  }
  const changed = JSON.stringify(stripStamp(existing)) !== JSON.stringify(stripStamp(fresh))
  // Keep the old record verbatim when nothing changed, so the file stays
  // byte-identical and `git log` on a season shows real changes, not a daily
  // timestamp churn. A season's scrapedAt therefore means "last changed".
  return { season: changed ? fresh : existing, action: changed ? 'updated' : 'unchanged' }
}

/** scrapedAt changes every run; ignore it when deciding if anything really changed. */
const stripStamp = ({ scrapedAt, ...rest }) => rest

export async function writeArchive (dir, merged) {
  await mkdir(dir, { recursive: true })
  for (const [name, record] of merged) {
    await writeFile(join(dir, seasonFile(name)), JSON.stringify(record, null, 2) + '\n')
  }
}
