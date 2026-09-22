/**
 * Low-level client for cyo.orgsonline.com.
 *
 * The site is ASP.NET WebForms with Telerik RadComboBox controls. There are no
 * clean URLs: selections are driven by form postbacks and the chosen team is
 * held in server-side session state. So every read is a sequence of posts on a
 * single cookie-bearing session, and __VIEWSTATE must be carried forward from
 * the exact page that rendered the control we are "clicking".
 */
import * as cheerio from 'cheerio'

export const BASE = 'https://cyo.orgsonline.com/'
export const SCHEDULES_URL = BASE + 'Athletics_SchedulesStandings.aspx'
export const STANDINGS_URL = BASE + 'Athletics_Standings.aspx'

const UA = 'oll-sports-bot/1.0 (+https://github.com/; parish schedule mirror; contact daniel@craftedup.com)'

/** Telerik reads the selected id out of this JSON, not out of the visible text field. */
export function clientState (value, text) {
  return JSON.stringify({
    logEntries: [], value: String(value), text, enabled: true,
    checkedIndices: [], checkedItemsTextOverflows: false
  })
}

export class CyoClient {
  constructor ({ delayMs = 750, log = () => {} } = {}) {
    this.jar = new Map()
    this.delayMs = delayMs
    this.log = log
    this.requests = 0
  }

  #cookieHeader () {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  #storeCookies (res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }

  async #fetch (url, init) {
    // Be a polite guest: this is a small volunteer-run site.
    if (this.requests++) await new Promise(r => setTimeout(r, this.delayMs))
    const res = await fetch(url, {
      ...init,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        ...(this.jar.size ? { Cookie: this.#cookieHeader() } : {}),
        ...init?.headers
      }
    })
    this.#storeCookies(res)
    if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} -> ${res.status}`)
    return cheerio.load(await res.text())
  }

  get (url) {
    this.log(`GET ${url}`)
    return this.#fetch(url)
  }

  post (url, fields) {
    this.log(`POST ${url}`)
    return this.#fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString()
    })
  }
}

/** The hidden WebForms state that must accompany every postback. */
export function formState ($) {
  const v = id => $(`#${id}`).attr('value') ?? ''
  return {
    __VIEWSTATE: v('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: v('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: v('__EVENTVALIDATION'),
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    RadScriptManager1_TSM: '',
    ctl00_article_Grid_Teams_ClientState: ''
  }
}

/**
 * RadComboBox renders option labels as <li> and their ids in a parallel
 * `itemData` array inside an init script. Neither half is useful alone; zip
 * them positionally to recover the real {label -> id} map.
 */
export function comboOptions ($, name) {
  const labels = $(`#ctl00_article_${name}_DropDown li.rcbItem`)
    .map((_, el) => $(el).text().trim()).get()

  const html = $.html()
  const marker = `"_uniqueId":"ctl00$article$${name}"`
  const at = html.indexOf(marker)
  if (at < 0) throw new Error(`combo ${name} not found`)
  const start = html.lastIndexOf('$create(Telerik.Web.UI.RadComboBox', at)
  const m = /"itemData":(\[.*?\])/s.exec(html.slice(start, at + 200000))
  if (!m) throw new Error(`combo ${name} has no itemData`)
  const values = JSON.parse(m[1]).map(d => d.value)

  if (labels.length !== values.length) {
    throw new Error(`combo ${name}: ${labels.length} labels vs ${values.length} values`)
  }
  return labels.map((label, i) => ({ label, value: values[i] }))
}

/** Fields that re-assert the current combo selections on a postback. */
export function selection (name, { label, value }) {
  return {
    [`ctl00$article$${name}`]: label,
    [`ctl00_article_${name}_ClientState`]: clientState(value, label)
  }
}

/** Image buttons post their click coordinates rather than a value. */
export function imageButton (name) {
  return { [`${name}.x`]: '8', [`${name}.y`]: '8' }
}

/** Read a Telerik grid into rows of trimmed cell text. */
export function gridRows ($, id) {
  const rows = []
  $(`#${id} tr`).each((_, tr) => {
    const cells = $(tr).find('td, th')
      .map((_, td) => $(td).text().replace(/\s+/g, ' ').replace(/ /g, ' ').trim())
      .get()
    if (cells.some(Boolean)) rows.push(cells)
  })
  return rows
}
