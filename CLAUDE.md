# Grays Harbor Jail Roster — Project Context

## What it is
A public jail roster monitor for Grays Harbor County, WA (Aberdeen/Hoquiam). Scrapes the county's static HTML roster page every 30 minutes, tracks bookings and releases, and displays them on a public website.

## URLs
- **Live site:** not deployed yet — will be https://theonlytacocat.github.io/grays-harbor-jail-monitor/ once GitHub Pages is enabled
- **GitHub repo:** not created yet — planned at github.com/recordwatch/grays-harbor-jail-monitor
- **Source data:** Grays Harbor County (Central Services dept) — http://ghlea.com/JailRosters/GHRoster.html ("County Wide" roster)

## Architecture
- **Scraper:** `scrape.js` — standalone Node.js script, runs via GitHub Actions cron every 30 min
- **Frontend:** React + Vite, served as static files on GitHub Pages (`gh-pages` branch)
- **Data storage:** JSON files committed to git in `data/` — no server, no database
- **Hosting cost:** $0

## Key technical notes
- Source is static server-rendered HTML (the page itself has `<meta http-equiv="refresh" content="1800">`, not JS/AJAX) — `scrapers/graysHarbor.js` uses cheerio, same approach as Kitsap/Pierce/Thurston. Not a JSON API like Whatcom, not a PDF dump like Mason.
- `GHRoster.html` ("County Wide") is a combined view of three separate facility rosters — county jail (GHCJRoster.html), Aberdeen PD (APDRoster.html), Hoquiam PD (HPDRoster.html). Scraping this one page covers all three (confirmed row counts: 103 + 14 + 16 = 133 matches the combined total). The `facility` field (GHCJ/APD/HPD) on each entry tells you which.
- The **Number** column (`<td>` right after the name) is the stable per-booking identifier — confirmed unique across all current entries, used as `idnum`/`bookingNumber`. It's also the `offenderID` in the page's VineLink register-for-release links.
- Full charge detail (arrest date, arresting agency, court, warrant/citation#, description, disposition, bond, bond type, bond amount) is in a hidden `tr` sub-table right after each main row — no separate detail-page fetch needed, same as Whatcom.
- Release detection is diff-based: if a booking `Number` drops off the County Wide roster, it's marked released (same approach as every other county monitor here).
- Mutable fields (facility transfers between GHCJ/APD/HPD, charge disposition updates) are refreshed every run for anyone still in custody.
- The site is served over plain HTTP (no HTTPS) — `axios` requests use `http://ghlea.com/...` directly.

## Key files
- `scrape.js` — main scraper script, writes all `data/*.json` files
- `scrapers/graysHarbor.js` — cheerio-based fetch + parse of GHRoster.html
- `utils.js` — `nowPST()` helper with `hourCycle: 'h23'` (prevents midnight 24:xx bug)
- `data/change_log.json` — full history of all bookings/releases
- `data/roster.json` — current roster state, keyed by booking `Number`
- `data/status.json` — `{inCustody, lastUpdated}`
- `.github/workflows/scrape.yml` — GitHub Actions workflow (scrape + build + deploy)
- `frontend/src/App.jsx` — React app, HashRouter, fetches from `./data/*.json` (unmodified from Whatcom — data shape is compatible)
- `frontend/vite.config.js` — `base: './'` for GitHub Pages compatibility

## Data format
- `change_log.json` is an array of booking entries, newest first
- Each entry: `idnum`/`bookingNumber` (the roster's Number column), `name`, `status` (in_custody/released), `firstSeen`, `releasedAt`, `bookingDate`, `facility` (GHCJ/APD/HPD), `charges[]`, `hasDetail` (always true)
- Each charge: `{ charge, court, causeNumber, bail, bondType, bond, arrestAgency, arrestDate, disposition }` — no `dispositionDate`, `arrestType`, or `eventNumber` fields (not present in this source, unlike Whatcom)
- `name` format: `LAST, FIRST MIDDLE`
- `firstSeen` format: "MM/DD/YYYY, HH:MM:SS" (PST)

## Color scheme
- Teal/harbor theme (distinct from Kitsap's blue, Pierce's green, Thurston's amber/bronze, Whatcom's violet/storm)
- Background: #0D1A1B, primary accent: #2E9C8F, secondary accent: #4FBFAE, highlight: #7FE0D3

## Related projects
- **Kitsap Jail Roster** — https://theonlytacocat.github.io/ksco-scraper/
- **Pierce County Jail Roster** — https://theonlytacocat.github.io/pierce-jail-roster/
- **Thurston County Jail Roster** — https://theonlytacocat.github.io/thurston-jail-roster/
- **Whatcom County Jail Roster** — https://github.com/recordwatch/whatcom-jail-monitor
- **Mason County Jail Roster** — https://alexasroster.com (also serves the wajaildata.org hub page)
- **Washington Jail Data hub** — https://wajaildata.org — landing page linking all county monitors; served from `mason-jail-roster/server.js` around the `.nav-section` block. Add a `<a class="nav-btn">` entry there once this site is live.

## Setup steps still needed
1. Create the `recordwatch/grays-harbor-jail-monitor` GitHub repo, add as remote, and push
2. Enable GitHub Pages (Settings → Pages → deploy from `gh-pages` branch), same as the other repos
3. Trigger the `scrape.yml` workflow once manually (workflow_dispatch) to confirm it runs end-to-end
4. Add the Grays Harbor link to `mason-jail-roster/server.js`'s `.nav-section` (wajaildata.org hub)
