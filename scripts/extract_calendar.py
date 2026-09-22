#!/usr/bin/env python3
"""
Extract the CYO annual Calendar of Events PDF into dated, categorised JSON.

This is an ANNUAL document, not a daily feed, so run it by hand when CYO
publishes a new calendar -- the daily scraper does not touch it.

    pip install pdfplumber
    python3 scripts/extract_calendar.py <pdf-or-url> data/cyo-calendar.json

Two things make this more than a text dump:

1. The calendar is a ruled month grid. Plain text extraction loses the column
   alignment and silently misattributes events to the wrong date, so we work
   from the table cells.
2. One day cell often holds several unrelated events ("Holy Day" plus "Football
   Weigh-Ins ..."). Line breaks alone cannot tell a new event from a wrapped
   line, so we split on vertical spacing: wrapped lines sit ~11pt apart and
   separate events ~21pt apart. The wrap leading is a constant of the document,
   so it is measured once over every cell rather than per cell -- a single cell
   holds too few lines for its own median to be trustworthy.

Each event is tagged:
    sport     -- start dates, deadlines, playoffs, championships, practices
    blackout  -- explicit "No CYO Sports" days
    other     -- office closures, board meetings, chess/music/civic holidays
"""
import json, re, sys, statistics, urllib.request, warnings, calendar as _cal
from pathlib import Path
import pdfplumber

warnings.filterwarnings('ignore')

MONTHS = {m.lower(): i for i, m in enumerate(_cal.month_name) if m}
TITLE_RE = re.compile(r'^\s*([A-Za-z]+)\s+(\d{4})\s*$', re.M)
DAYS = {'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'}

SPORTS = (r'football|volleyball|basketball|kickball|soccer|softball|baseball|'
          r'wrestling|track\s*&?\s*field|cross\s*-?\s*country|sports?\b')
# A sport name alone is not enough ("No CYO Sports"); it needs a sport *event*.
SPORT_EVENT = (r'begins?\b|\bdue\b|playoffs?|championships?|tournament|practice|'
               r'weigh-?ins?|seeding|coaches meeting|opening weekend|city')
BLACKOUT_RE = re.compile(r'no\s+cyo\s+sports', re.I)


def classify(title: str) -> str:
    if BLACKOUT_RE.search(title):
        return 'blackout'
    t = title.lower()
    if re.search(SPORTS, t) and re.search(SPORT_EVENT, t):
        return 'sport'
    return 'other'


def page_month(page):
    for line in (page.extract_text() or '').splitlines()[:4]:
        m = TITLE_RE.match(line)
        if m and m.group(1).lower() in MONTHS:
            return MONTHS[m.group(1).lower()], int(m.group(2))
    return None


def cell_lines(page, cell):
    """(day_number, [line tops], [line texts]) for one day cell."""
    x0, top, x1, bot = cell
    words = [w for w in page.extract_words()
             if w['x0'] >= x0 - 1 and w['x1'] <= x1 + 1
             and w['top'] >= top - 1 and w['bottom'] <= bot + 1]
    if not words:
        return None, [], []

    lines = {}
    for w in words:
        lines.setdefault(round(w['top'], 1), []).append(w)
    tops = sorted(lines)
    texts = [' '.join(w['text'] for w in sorted(lines[t], key=lambda w: w['x0'])) for t in tops]

    if not texts or not texts[0].strip().isdigit():
        return None, [], []
    # Drop the day number: its spacing to the first event differs from the
    # body leading and would pollute the measurement.
    return int(texts[0].strip()), tops[1:], texts[1:]


def wrap_leading(cells):
    """Modal gap between consecutive lines -- i.e. the wrapped-line leading."""
    gaps = []
    for _, tops, _ in cells:
        gaps += [round(b - a) for a, b in zip(tops, tops[1:])]
    return statistics.mode(gaps) if gaps else 0


def split_events(tops, texts, threshold):
    if not texts:
        return []
    events, buf = [], [texts[0]]
    for i, gap in enumerate((b - a for a, b in zip(tops, tops[1:])), start=1):
        if gap > threshold:
            events.append(' '.join(buf))
            buf = [texts[i]]
        else:
            buf.append(texts[i])
    events.append(' '.join(buf))
    return [re.sub(r'\s+', ' ', e).strip() for e in events if e.strip()]


def extract(pdf_path):
    out = []
    with pdfplumber.open(pdf_path) as pdf:
        # Pass 1: read every cell so the wrap leading can be measured document-wide.
        parsed = []
        for pno, page in enumerate(pdf.pages, 1):
            my = page_month(page)
            if not my:
                continue
            month, year = my
            tables = page.find_tables()
            if not tables:
                continue
            for row in tables[0].rows:
                for cell in row.cells:
                    if not cell:
                        continue
                    day, tops, texts = cell_lines(page, cell)
                    if day and texts:
                        parsed.append(((pno, year, month, day), tops, texts))

        leading = wrap_leading([(None, t, x) for _, t, x in parsed])
        threshold = leading * 1.5 if leading else 1e9

        # Pass 2: split each cell into its separate events.
        for (pno, year, month, day), tops, texts in parsed:
            if day > _cal.monthrange(year, month)[1]:
                continue
            for title in split_events(tops, texts, threshold):
                if title.upper() in DAYS:
                    continue
                out.append({
                    'date': f'{year:04d}-{month:02d}-{day:02d}',
                    'title': title,
                    'category': classify(title),
                    'source': f'page {pno}',
                })
    # Same event can be picked up once per overlapping cell boundary.
    seen, uniq = set(), []
    for e in sorted(out, key=lambda e: (e['date'], e['title'])):
        k = (e['date'], e['title'])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)
    return uniq


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/cyo-calendar.json')
    path = src
    if src.startswith('http'):
        path = Path('/tmp/cyo-calendar.pdf')
        urllib.request.urlretrieve(src, path)
    events = extract(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'source': src, 'events': events}, indent=2) + '\n')
    counts = {}
    for e in events:
        counts[e['category']] = counts.get(e['category'], 0) + 1
    print(f'{len(events)} events -> {out}  {counts}')


if __name__ == '__main__':
    main()
