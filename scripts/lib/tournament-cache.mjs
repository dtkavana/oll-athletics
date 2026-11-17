/**
 * Persist full CYO tournament brackets.
 *
 * Athletics_Tournaments.aspx drops finished brackets, and the parish scrape
 * only keeps games involving our teams. Ratings need every scored matchup, so
 * each scrape/ratings run merges the live listing into this cache and ratings
 * can still apply a bracket after CYO takes it down.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const TOURNAMENT_CACHE = resolve(ROOT, 'data/ratings/tournament-brackets.json')

export async function readTournamentCache () {
  try {
    const file = JSON.parse(await readFile(TOURNAMENT_CACHE, 'utf8'))
    return Array.isArray(file.brackets) ? file.brackets : []
  } catch {
    return []
  }
}

/** Upsert live brackets by title; leave cached-only brackets alone. */
export async function mergeTournamentCache (live) {
  const prev = await readTournamentCache()
  const byTitle = new Map(prev.map(b => [b.title, b]))
  for (const b of live) {
    if (!b?.title) continue
    byTitle.set(b.title, {
      title: b.title,
      host: b.host ?? null,
      notes: b.notes ?? null,
      status: b.status ?? null,
      rounds: b.rounds ?? null,
      games: b.games ?? [],
      cachedAt: new Date().toISOString()
    })
  }
  const brackets = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title))
  await mkdir(dirname(TOURNAMENT_CACHE), { recursive: true })
  await writeFile(TOURNAMENT_CACHE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    brackets
  }, null, 2) + '\n')
  return brackets
}

/** Live listing first, then cached brackets whose titles are no longer listed. */
export function combineBrackets (live, cached) {
  const seen = new Set(live.map(b => b.title))
  const out = [...live]
  for (const b of cached) {
    if (!b?.title || seen.has(b.title)) continue
    out.push(b)
    seen.add(b.title)
  }
  return out
}
