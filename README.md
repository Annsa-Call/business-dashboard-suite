# Business Dashboard Suite — Google Sheets + Apps Script

**Thirty industry dashboards. One codebase. ~112,000 rows of research-backed sample data.**

Each trade gets its **own layout**, its **own units** (FCR, RevPAR, litres, kW, impressions, DHU,
bay-hours) and its **own six numbers** — because a poultry farm and a law firm should never share
a template.

Built for people who sell dashboards: pick a vertical, open the demo, close the client.
Everything runs inside Google Sheets — no Looker Studio licence, no Supermetrics connector,
no per-seat fee.

---

## What's in this ZIP

```
business-dashboard-suite/
├── README.md                  ← you are here
├── index.html                 ← THE DEPLOYED SITE (portfolio home, 30 cards → demos/…)
├── assets/                    ← your portrait (320/640, webp + jpg)
├── thumbs/                    ← 760px WebP card thumbnails, ~21 KB each (the PNGs are 750 KB)
├── apps-script/               ← install these three files
│   ├── Code.gs                engine + the 30 industry definitions (KPIs, charts, tables, layout)
│   ├── SeedData.gs            sample-data builder (112k rows, 18 months, seasonal, 90 tabs)
│   └── Index.html             the dashboard UI (self-contained, no CDN, 8 layout presets)
├── demos/                     ← 30 standalone HTML demos (open in any browser, no Google account)
│   ├── 01_Digital-Marketing-Agency.html
│   ├── … 30 files, one per industry
├── 404.html                   ← served automatically for missing paths
├── _headers                   ← Cloudflare Pages caching + security headers
├── _redirects                 ← /portfolio → /
├── netlify.toml                ← ignored by Cloudflare; used only if you deploy to Netlify
├── portfolio/
│   └── index.html             ← same page with ../ paths, for opening straight off disk
├── docs/
│   ├── 01_SETUP_GUIDE.md      install in 5 minutes, both paths
│   ├── 02_KPI_LIBRARY.md      30 industries: what each tracks, why, published benchmarks
│   ├── 03_PORTFOLIO_GUIDE.md  how to post these and what to say
│   ├── 04_CORRECTIONS.md      what changed vs the original 12 folders
│   ├── 05_CUSTOMISING.md      change a metric, add an industry, add a layout
│   ├── 06_HOSTING_DECISION.md    which host, and why (Cloudflare / Netlify / not Vercel Hobby)
│   ├── 07_INSTAGRAM_CATEGORIES.md the 30 categories to search/follow, ranked by how they close
│   └── 08_CLOUDFLARE_PAGES.md   **step-by-step Cloudflare Pages deploy — start here**
├── tools/                     ← rebuild the demos + portfolio from the .gs files
│   ├── build-demos.js         runs the real Apps Script code, validates, writes demos + screenshots
│   ├── make-thumbs.py         screenshots → 760px WebP thumbnails + portrait sizes (Pillow)
│   └── build-portfolio.js     writes index.html from the payloads (edit PROFILE block at the top)
└── screenshots/               30 PNGs + portfolio + mobile proof (for listings/thumbnails)
```

---

## The thirty

**Core services (1–15)**

| # | Industry | The six numbers on the screen | Layout |
|---|---|---|---|
| 01 | Digital Marketing Agency | Pipeline · Retainers · MRR · Collected · Overdue · Follow-ups | grid |
| 02 | Real Estate (Karachi) | Listings · Portfolio value · Enquiries · Commission · Days on market | board |
| 03 | Coaching & Courses | Students · Revenue · Attendance · Fee/student · Outstanding · Completion | grid |
| 04 | Retail / E-commerce | Revenue · Orders · AOV · Gross margin · Repeat rate · Returns | ledger |
| 05 | Restaurant & Café | Revenue · Avg check · Food cost · Prime cost · Delivery share · Opex | gauge |
| 06 | Salon · Spa | Bookings · Revenue · Ticket · No-show · Rebooking · Chair utilisation | calendar |
| 07 | Gym · Fitness | Members · MRR · Churn · Visits/member · Renewals · PT revenue | hero |
| 08 | School · Academy | Students · Fee collected · Collection rate · Arrears · Attendance | scorecard |
| 09 | Clinic · Dental | New patients · Appointments · No-shows · Production · Collection · AR 90+ | grid |
| 10 | Travel Agency | Bookings · GMV · Commission · Avg booking · Cancellations · Deposits | board |
| 11 | Construction | Projects · Backlog · Billed · Receivables · Margin · Overruns | timeline |
| 12 | Event Photography | Events · Revenue · Avg package · Pipeline · Deliveries · Referrals | calendar |
| 13 | SaaS / Software | MRR · NRR · Logo churn · ARPA · MRR growth · Open tickets | hero |
| 14 | Logistics & Freight | Shipments · OTIF · Revenue · Cost/shipment · Receivables · Exceptions | scorecard |
| 15 | Law Firm | Billable hours · Utilisation · Realisation · Collection · WIP · Receivables | ledger |

**Specialist trades (16–30)** — each with its own units, not rupees-per-month

| # | Industry | The unit that decides the week | Layout |
|---|---|---|---|
| 16 | Boutique Hotel | Room-nights · ADR · RevPAR (% and rate) | hero |
| 17 | Plastics Plant | OEE = A × P × Q, machine-minutes | gauge |
| 18 | Recruitment Agency | Days to fill · fee % of CTC | ledger |
| 19 | Community Pharmacy | Scripts/day · days of stock · expiry risk | calendar |
| 20 | Broiler Poultry Farm | FCR (kg feed/kg bird) · mortality % · Rs/kg | scorecard |
| 21 | Fuel Station | Litres/day · dealer margin **Rs 9.98/L** | board |
| 22 | Managed IT (MSP) | Minutes to first response · endpoints/tech | timeline |
| 23 | Auto Workshop | Job cards · bay-hours · parts margin | gauge |
| 24 | Printing Press | Impressions · waste-sheet % | ledger |
| 25 | Garment Unit | Line efficiency % · DHU per 100 | scorecard |
| 26 | Bakery | kg baked · wastage by weight | calendar |
| 27 | Courier / Last Mile | On-time % · COD in float | timeline |
| 28 | Architecture Studio | Billable hours · fee per sqft | hero |
| 29 | Veterinary Clinic | Consults/day · vaccination uptake | grid (2-up) |
| 30 | Solar EPC | kW installed · Rs per watt | board |

**Eight layouts, not one template:** grid · hero · ledger · gauge · calendar · scorecard · board ·
timeline. The layout is a property of the industry (`layout: { preset, kpiCols }` in `Code.gs`), so
a hotel leads with its occupancy number, a printing press puts its job ledger beside the numbers,
and a pump station puts the shift log first.

---

## Two ways to use it

### A. Show the demos (no Google account needed)
Open `portfolio/index.html` → click any industry. Each file in `demos/` is a single 100 KB HTML
file with the data embedded, so it opens offline, on a phone, or attached to a WhatsApp message.
The industry switcher top-right jumps between demos.

### B. Install the live version in a real spreadsheet (5 minutes)
1. New Google Sheet → **Extensions → Apps Script**.
2. Paste `apps-script/Code.gs` into `Code.gs`.
3. **+ → Script**, name it `SeedData`, paste `apps-script/SeedData.gs`.
4. **+ → HTML**, name it exactly `Index`, paste `apps-script/Index.html`.
5. Save, reload the sheet → **📊 Dashboard → Seed demo data…** → type `all` (or one industry).
6. **📊 Dashboard → Open dashboard**. Audit uses `?demo=clinic` on the deployed URL.

Full walk-through, including granting permissions and deploying as a web app: `docs/01_SETUP_GUIDE.md`.

---

## Why the data looks real

The numbers are not random noise. `SeedData.gs` models:

- **Volume** by weekday and season (Ramadan/Eid spikes for food and retail, a dip for B2B,
  wedding season for photography and salons, monsoon slowdown for construction and freight,
  January sign-ups for gyms, admission season for schools).
- **Money** on a power curve: a handful of clients carry most of the revenue, the rest tail off.
- **Ageing**: old invoices are almost all settled, recent ones are still open, and a small
  believable slice is genuinely overdue. That is what makes "AR over 90 days" meaningful
  instead of a pile of every unpaid row since day one.
- **Sizes per market**: a Karachi dental practice bills ~Rs 5–10M/month; a café does ~Rs 200K
  a day; a freight forwarder bills ~Rs 185K per consignment; an agency retainer is Rs 30K–450K;
  a 44-room boutique hotel runs 55% occupancy at Rs 34K ADR; a fuel station moves 34,000 L/day at
  a government-set Rs 9.98/L dealer margin.
- **Units per industry**: FCR, DHU, OEE, RevPAR, Rs/W, bay-hours, impressions, kg of waste. If a
  number only makes sense in that trade, it is in that trade's demo and nowhere else.

Every generator is deterministic (fixed seed), so the demos are reproducible — and every
industry's ratios were checked against published benchmarks (see `docs/02_KPI_LIBRARY.md`).

---

## The one number each industry actually watches

| Industry | If you only fix one thing |
|---|---|
| Agency | Days-to-cash on retainers |
| Real estate | Days on market |
| Coaching | Attendance → completion → referrals |
| E-commerce | Repeat purchase rate, not ROAS |
| Restaurant | Prime cost (food + labour) |
| Salon | Rebooking rate at checkout |
| Gym | First-90-days churn |
| School | Collection rate before salary week |
| Clinic | Collection rate + AR over 90 days |
| Travel | Deposit collection on confirmed bookings |
| Construction | Retention + over-billing lag |
| Photography | Referral share |
| SaaS | Net revenue retention |
| Logistics | OTIF |
| Law firm | Realisation (worked → billed) |
| Hotel | RevPAR — the rate × occupancy product |
| Factory | The downtime reason, not the OEE score |
| Recruitment | Time-to-fill on the roles you keep losing |
| Pharmacy | Days of stock cover |
| Poultry | FCR before the feed bill lands |
| Fuel station | Litres per day (margin is fixed) |
| MSP | First-response minutes |
| Workshop | Bay-hours sold |
| Printing | Waste sheets |
| Garment | DHU |
| Bakery | Wastage by weight |
| Courier | COD still in float |
| Architecture | Unbilled WIP |
| Vet | Booster recall |
| Solar | Net-metering approvals pending |

That list is the pitch. The dashboard is the proof.

---

## Support / editing

- Change a metric, a tab name or a heading → `docs/05_CUSTOMISING.md`
- Add a 31st industry → same file, ~80 lines, copy an existing block
- Change a page layout → `layout: { preset: 'hero' }` on the industry (8 presets, see §4b in `Index.html`)
- Turn off the demo switcher for a client install → `SETTINGS.SHOW_SWITCHER = false`
- Use USD/EUR instead of PKR → `SETTINGS.CURRENCY` + `SEED_CONFIG.CURRENCY_FORMAT`

## Hosting

The repo root **is** the website: `index.html` + `demos/` + `thumbs/` + `assets/`, with `_headers`,
`_redirects` and `404.html` already in place for Cloudflare Pages.

**Cloudflare Pages (recommended — unlimited bandwidth, free, commercial use allowed):**
push the folder to GitHub → Workers & Pages → Create → Pages → Connect to Git → pick the repo →
Framework preset **None**, Build command **blank**, Build output directory **`/`** → Save and Deploy.

Full click-by-click guide, custom domain, password protection, rollback and troubleshooting:
**`docs/08_CLOUDFLARE_PAGES.md`**. Why not Vercel Hobby: `docs/06_HOSTING_DECISION.md`.

Licence: use it for your own client work and portfolio. Reselling the template itself isn't
covered — everything else is.
