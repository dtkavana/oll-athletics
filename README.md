# OLL Sports

Schedules, scores and standings for **Our Lady of Lourdes (Indy)** and **East Side
Crusaders** CYO teams, mirrored daily from the Archdiocese of Indianapolis CYO site.

Static Nuxt site. No database, no server: a scheduled GitHub Action scrapes CYO,
commits the resulting JSON, and rebuilds the site. Past seasons are kept even
after CYO stops publishing them — see **Archive** below.

## Look & feel

School colours are **navy `#002B5C`** and **gold `#DDB426`**, with the Lyon
mascot as the recurring motif (`public/brand/`). The design leans collegiate
rather than generic-dashboard:

- **Anton** for headings, team names and scores; **Barlow** / **Barlow
  Condensed** for body and labels. Both self-hosted via `@fontsource`, so there
  is no third-party font request.
- Navy is used as a *ground* (masthead, hero, table headers, day bars), not just
  an accent, and content sits on warm paper `#F4F1E8` rather than cold grey.
- Squared corners, a gold/white/gold varsity stripe under the masthead, and a
  scoreboard chip (`W` + tabular score) instead of a plain results column.
- Each fixture carries a sport-coloured stripe down its left edge; the sport
  palette is the validated categorical set (see **Calendar page** below).

Dark mode is a deliberate second palette, not an inversion.

## Quick start

```bash
nvm use            # Node 22+ (Nuxt 4 / Vite 8 require it)
npm install
npm run scrape     # refresh data/snapshot.json from CYO (~50s)
npm run dev
```

## How the scrape works

`cyo.orgsonline.com` is ASP.NET WebForms with Telerik controls. There are no clean
URLs and no API, so the scraper drives the real forms:

- Dropdown options live in `<li class="rcbItem">` while their ids live in a
  parallel `itemData` array inside a `$create(Telerik.Web.UI.RadComboBox, …)`
  script. `comboOptions()` zips them positionally.
- Selecting a parish and season is a `__VIEWSTATE` postback; each team's "games"
  icon is a separate image-button postback that 302s to a page with **no query
  parameters** — the chosen team lives in server session state. So the scraper
  keeps one cookie jar and works strictly in order.
- The standings league dropdown cascades off the season, so the season change is
  posted first (`__EVENTTARGET`) to repopulate it.

Requests are spaced by `CYO_DELAY_MS` (default 600ms); a full run is ~90 requests.
The scraper refuses to overwrite `data/snapshot.json` if it scrapes zero teams, so a
CYO outage or markup change leaves the last good data in place.

| Path | What it is |
| --- | --- |
| `scripts/scrape.mjs` | Orchestration; writes the archive + `data/snapshot.json` |
| `scripts/lib/archive.mjs` | Per-season archive: merge, shrink guard, retention |
| `scripts/lib/cyo.mjs` | Cookie jar, postbacks, Telerik/grid parsing |
| `scripts/lib/parse.mjs` | Parsers for CYO's free-text cells |
| `scripts/lib/tournaments.mjs` | Tournament listing + bracket parsing |
| `scripts/lib/venues.mjs` | Works out which side hosted, from the venue |
| `scripts/lib/youtube.mjs` | A/V club channel feed (public RSS, no API key) |
| `scripts/extract_calendar.py` | **Annual, run by hand** — CYO Calendar of Events PDF → JSON |

### Refreshing the annual CYO calendar

The archdiocesan dates come from a PDF that CYO publishes once a year. It lives in
`data/cyo-calendar.json`, separate from the scrape snapshot, so re-extracting it
never requires re-scraping CYO:

```bash
pip install pdfplumber
python3 scripts/extract_calendar.py <url-to-pdf> data/cyo-calendar.json
```

Two details make this more than a text dump. The calendar is a ruled month grid,
so extraction works from table cells — plain text loses the column alignment and
misattributes events to the wrong date. And one day cell often holds several
unrelated events ("Holy Day" plus "Football Weigh-Ins …"); line breaks cannot
tell a new event from a wrapped line, so events are split on vertical spacing.
Wrapped lines sit ~11pt apart and separate events ~21pt, and that leading is
measured once across the whole document because a single cell has too few lines
for its own median to be reliable.

Each event is then tagged:

| Category | Shown? | Examples |
| --- | --- | --- |
| `sport` | yes | season start dates, team/gym deadlines, practices, weigh-ins, playoffs, championships |
| `blackout` | opt-in toggle | explicit "No CYO Sports" days (Holy Week, spring break) |
| `other` | no | office closures, board meetings, chess, music, civic holidays |

The site shows `sport` only by default. To change what counts, edit `classify()`
in `scripts/extract_calendar.py` and re-run it.

## Calendar page

The key and the filters are the same control: each swatch shows a sport's colour
and toggles it. CYO archdiocesan events toggle separately and are styled as a
distinct kind of thing (gold rule + `CYO` tag) rather than as another sport.
Clicking any day opens the full detail for that day — every game with venue,
time, league, division, score and a link to the team page.

Sport hues are slots 1–4 of a validated categorical theme, assigned per sport and
never cycled. At most three sports ever share a month view, and each live triple
was checked with the dataviz palette validator (`--pairs all`) in both light and
dark. Colour means sport only: results ride a `W`/`L`/`T` badge so the key stays
true.

## A/V club broadcasts

The `/watch` page lists the channel's uploads, split into game broadcasts and
other school videos. A video is only associated with a fixture when its title
actually names a sport — the club also films concerts and Masses, and those
would otherwise match a same-day game spuriously.

**Getting the full history.** YouTube's `/streams` tab is client-rendered, its
public RSS feed exposes only the **15 most recent** uploads, and the channel
page's initial payload carries just 8 (the rest arrive via scroll
continuations). So by default the site can only see back a few months.

Two mitigations:

- Results merge into `data/videos.json`, an accumulating archive. Nothing seen
  is ever dropped, so the window fills in from here on.
- Set a **`YOUTUBE_API_KEY`** and the scraper pages the channel's uploads
  playlist through the official Data API instead, backfilling everything at
  once.

### Setting up the key

Create it at <https://console.cloud.google.com/apis/credentials> with **YouTube
Data API v3** enabled. It is free — listing every upload costs a handful of the
10,000 daily quota units.

Restrictions to set on the key:

| Setting | Value | Why |
| --- | --- | --- |
| Application restrictions | **None** | GitHub Actions runners come from a large, rotating IP range, and HTTP-referrer restrictions only apply to browser calls. Neither can be used for a server-side key. |
| API restrictions | **Restrict key → YouTube Data API v3** | The real protection. Even if the key leaks it can only read public YouTube data. |

The key is *not* a credential for private data — it identifies the project for
quota on public read calls. The exposure risk is quota abuse, not a data breach.
Still, do not reuse a key that has other Google APIs enabled.

It is needed in exactly two places:

1. **Locally** — copy `.env.example` to `.env` and fill it in. `.env` is
   gitignored, and `npm run scrape` loads it automatically.
2. **GitHub** — repository *Settings → Secrets and variables → Actions → New
   repository secret*, named `YOUTUBE_API_KEY`. The workflow already passes it
   to the scrape step.

Nowhere else. The scraper runs at scrape time and writes JSON; the key never
enters the Nuxt build, the published site, or `data/`. Never put it in a
`NUXT_PUBLIC_*` variable — those are bundled into the browser.

Strictly speaking one successful run is enough, since videos accumulate in
`data/videos.json`. Leaving it set is still better: it catches new uploads even
when more than 15 land between runs.

## Archive

CYO's dropdowns expose only a rolling window of seasons, so a scrape is a
snapshot of what is *currently published*, not of everything that happened.
Writing that straight over the data file would silently drop a season the day
CYO stops listing it.

So each season is its own file:

```
data/seasons/2026-fall-girls-volleyball.json   teams + games + standings
data/snapshot.json                             merged view the site imports
```

A run refreshes the seasons it saw and **leaves every other file untouched**, so
the archive only ever grows. `snapshot.json` is regenerated from the whole
archive each run, which is why a retired season keeps rendering; those seasons
are listed in `retiredSeasons` and shown as *Archived* on the teams page.

Two safeguards:

- A scrape returning zero teams aborts before writing anything.
- A season whose fresh game count drops below 80% of what is archived is
  **not** overwritten (a half-down CYO shouldn't truncate history). Losing one
  game to a cancellation is tolerated; losing a fifth of them is not.

An unchanged season is rewritten byte-identically, so `git log` on a season file
shows real changes rather than daily timestamp churn — and a season's
`scrapedAt` means "last changed". Git history is the audit trail for score
corrections.

```bash
npm run scrape     # refresh from CYO and merge into the archive
npm run rebuild    # regenerate snapshot.json from data/seasons/ — no network
```

Use `rebuild` after hand-editing or removing a season file.

### What predates the archive is gone

The archive starts the day we first scraped, so the seasons CYO listed then are
the historical floor. CYO drops a season from its dropdowns roughly six months
after it ends, and the server **refuses any season id not currently listed** —
verified against real ids recovered from archived copies of the dropdown
(e.g. 1832 = "2025-2026 Boys Basketball"), which all fall back to the default
season on both the schedules and standings pages. Archived copies of the site
only captured landing pages; the crawler held no session, so no postback result
was ever archived.

`data/season-catalog.json` lists 51 seasons back to 2019 with their names and
ids, recovered from those archived dropdowns. It holds no game data — its use is
to name a season precisely when asking the CYO office (317) 632-9311 to
re-publish or export it. If CYO ever re-lists one, the daily scrape picks it up
and archives it with no code change.

## Tournaments

`Athletics_Tournaments.aspx` lists every bracket; each "[Go]" is a postback that
redirects to `tournament_display.aspx`, session-held like team schedules. The
bracket itself is a tidy fragment where each matchup is a
`game-top` / `game-spacer` / `game-bottom` triple — two sides with scores, and a
middle carrying date, time and venue.

The hard part is deciding which of our teams a bracket belongs to. A bracket
names its teams but not its league, and a parish fields the same team name in
several leagues at once ("OL Lourdes-Gold" plays 3/4 Mixed, 56 A *and* Cadet A
kickball). Matching on roster overlap with the standings looks appealing and is
wrong: a larger league table coincidentally contains more of any bracket's
parishes, which put the Cadet A bracket into 56 A Fall. The tournament title
states sport, year, term and league, so `matchLeague()` parses those and uses
roster overlap only as a sanity check. All four are needed — without the term, a
Fall kickball bracket also matches the spring 3/4 team.

Bracket games join `games` with a `tournament: { name, round, host, notes }`
field, so they appear on team pages, the calendar and the iCal feeds
automatically. Byes and undated future slots are skipped. Team records keep
league and tournament play separate, because CYO standings count league play
only and the two numbers sit next to each other on the team page.

## Team names

CYO suffixes every team with a colour ("OL Lourdes-Blue") because a parish may
field more than one team in a league. Where we field only one, that colour is
noise, so it is dropped — but **only for our own teams**, since we cannot know
how many teams another parish has in a league.

```
OL Lourdes-Blue   Cadet A Girls   ->  OL Lourdes        (only team in that league)
OL Lourdes-Blue   4th Girls       ->  OL Lourdes-Blue   (we field two, colour disambiguates)
OL Lourdes-Gold   4th Girls       ->  OL Lourdes-Gold
East Side Crusaders-Red  56       ->  East Side Crusaders
St. Roch-Gold                     ->  St. Roch-Gold     (another parish, untouched)
```

`displayTeam()` keys on season + league, so the colour reappears by itself the
moment a second Lourdes team is registered in the same league — no code change.
Team ids and URLs still use CYO's real names, so links and the archive are
unaffected. The iCal feeds mirror the same rule in their titles and event
summaries.

## Home, away and how a matchup reads

Fixtures always lead with our team, and the separator says where it is played:

```
home     OL Lourdes-Blue  vs  Holy Spirit, Indy-Yellow    OL Lourdes Gym
away     OL Lourdes-Blue  @   St. Roch-Gold               St. Roch Gym #1
neutral  East Side Crusaders-Red  vs  Johnson Co.-White   Central Catholic Fb
```

**CYO's team1/team2 order does not encode home and away** — measured across the
archive, team2 hosts slightly more often than team1, so the ordering is
arbitrary. The venue is the only reliable signal, and `scripts/lib/venues.mjs`
matches it back to a parish. Venue and team names abbreviate differently
("Immaculate Heart-Kb" vs "Immac. Heart"), so matching is token-based with
prefix tolerance rather than a string compare.

That resolves a host for ~79% of games (currently 51 home, 52 away). The rest
are genuinely neutral — high school football fields, Christian Park, the CYO
Center — and correctly resolve to no host, where the fixture reads "vs". A
parish gym hosting two *other* parishes is neutral for that game too.

The result is stored on each game as `homeSide` (1, 2 or null) so the pages and
the iCal feeds share one answer rather than each re-deriving it.

## League ordering

CYO returns leagues alphabetically, which puts "4th Girls" above "Cadet A Girls".
Standings and the teams list are re-sorted by `leagueRank()` into CYO's own
progression — Cadet A, Cadet B, Cadet C, 5/6 A, 5/6 B, 5/6 C, then 4th / 3-4.

## Calendar subscriptions

Every team gets a prerendered iCal feed at `/ics/<team-id>.ics`, plus
`/ics/all-games.ics` for everything. Parents subscribe by URL in Google or Apple
Calendar and games update themselves as CYO changes them.

## Deploying

`.github/workflows/daily.yml` scrapes, commits data, builds and publishes to
**GitHub Pages** daily. Enable Pages → "GitHub Actions" in repo settings.

Using Cloudflare Pages or Netlify instead? Point it at this repo with build
command `npm run generate` and output directory `.output/public`, then delete the
`deploy` job — the data commit alone will trigger their build.

## Caveats

- CYO can change times after we sync; the footer says so on every page.
- Cross country meets are not entered as games upstream, so that team has a page
  but no fixtures.
- The YouTube feed only exposes the 15 most recent uploads, so older broadcasts
  are reachable only on the channel itself.
