/**
 * The OLL Student Productions (A/V club) channel streams some games.
 *
 * Two sources, in order of preference:
 *
 *  1. YouTube Data API v3, when YOUTUBE_API_KEY is set. Pages through the
 *     channel's uploads playlist and returns the ENTIRE history.
 *  2. The channel's public RSS feed, which needs no key but exposes only the
 *     15 most recent uploads. (The channel page itself is worse -- its initial
 *     payload carries just 8 and the rest arrive via scroll continuations.)
 *
 * Either way the result is merged into an accumulating archive, so the 15-item
 * window fills in over time and nothing already seen is ever dropped.
 */
const CHANNEL_ID = 'UCf1bBZZfcj5QBCyTQSpxyMw'
export const CHANNEL_URL = 'https://www.youtube.com/@ollindyAVclub'
export const STREAMS_URL = `${CHANNEL_URL}/streams`
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
/** A channel's uploads playlist is its id with the UC prefix swapped for UU. */
const UPLOADS = 'UU' + CHANNEL_ID.slice(2)

const unescapeXml = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

const video = (id, title, published) => ({
  id,
  title,
  published,
  date: published?.slice(0, 10) ?? null,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
})

async function fromRss () {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'oll-sports-bot/1.0' } })
  if (!res.ok) throw new Error(`YouTube feed -> ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const pick = tag => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(e)?.[1]?.trim()
    return video(pick('yt:videoId'), unescapeXml(pick('title') ?? ''), pick('published'))
  }).filter(v => v.id)
}

async function fromApi (key) {
  const out = []
  let pageToken = ''
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.search = new URLSearchParams({
      part: 'snippet', playlistId: UPLOADS, maxResults: '50', key, ...(pageToken ? { pageToken } : {})
    })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`YouTube API -> ${res.status} ${(await res.text()).slice(0, 160)}`)
    const data = await res.json()
    for (const item of data.items ?? []) {
      const s = item.snippet
      if (s?.resourceId?.videoId) out.push(video(s.resourceId.videoId, s.title, s.publishedAt))
    }
    pageToken = data.nextPageToken ?? ''
  } while (pageToken && out.length < 1000)
  return out
}

export async function fetchVideos () {
  const key = process.env.YOUTUBE_API_KEY
  if (key) {
    const all = await fromApi(key)
    return { videos: all, source: 'api' }
  }
  return { videos: await fromRss(), source: 'rss' }
}

/** Merge into the archive: newest metadata wins, nothing is ever removed. */
export function mergeVideos (existing, fresh) {
  const byId = new Map(existing.map(v => [v.id, v]))
  let added = 0
  for (const v of fresh) {
    if (!byId.has(v.id)) added++
    byId.set(v.id, { ...byId.get(v.id), ...v })
  }
  const merged = [...byId.values()].sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
  return { merged, added }
}
