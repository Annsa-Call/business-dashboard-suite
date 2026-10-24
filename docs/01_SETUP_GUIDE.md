# 01 · Setup Guide

Two paths. Most people want **Path A** first (show the demos), then **Path B** when a client asks
"can it read *my* sheet?".

---

## Path A — Run the demos locally (2 minutes, no Google account)

1. Unzip the folder anywhere.
2. Double-click `portfolio/index.html`.
3. Click a card.

Each file in `demos/` is standalone: it contains the dashboard *and* an embedded copy of the data,
so it works offline, from a USB stick, or attached to an email. The dropdown in the top-right
jumps between industries; **About** shows what the numbers mean; **Theme** toggles dark mode.

Deploying the demos to the web: drag the whole folder onto Netlify Drop, Vercel, GitHub Pages or
Cloudflare Pages. `portfolio/index.html` becomes your landing page and the `demos/` links keep
working, because all paths are relative.

> Tip: if you only want the *look* on a phone, the demos are fully responsive down to 390 px.

---

## Path B — Install the live version in Google Sheets

### 1. Create the project
1. Open <https://sheets.new> (or an existing client sheet).
2. **Extensions → Apps Script**. A new project opens with `Code.gs`.

### 2. Add the three files
| Where | What | Name it exactly |
|---|---|---|
| `Code.gs` (already exists) | delete its contents, paste `apps-script/Code.gs` | `Code.gs` |
| **+ → Script** | paste `apps-script/SeedData.gs` | `SeedData` |
| **+ → HTML** | paste `apps-script/Index.html` | `Index` (capital I, no `.html` typed) |

Save (⌘/Ctrl + S).

### 3. Seed the data
1. Reload the spreadsheet tab. A **📊 Dashboard** menu appears.
2. **📊 Dashboard → Seed demo data…**
3. Type `all` (creates all 30 industries = 90 tabs) or a single slug such as `clinic`.
4. Approve the permission prompt: **Review permissions → choose account → Advanced → Go to project**.

First run takes ~20–40 seconds. You'll get a summary like `Clinic · Dental — 3,096 rows`.

> **One industry or all thirty?** All thirty is great for a demo spreadsheet you show people.
> It writes ~112,000 rows, which takes 2–4 minutes in a real Google Sheet. If you are installing
> for a single client, seed only their slug — it is faster and keeps the sheet readable.
> When you hand a real client their own file, seed **one** industry — or delete the other tabs and
> set `SETTINGS.TAB_PREFIX = false` so tabs are named simply `Invoices`, `Patients`, …

### 4. Open the dashboard
- **📊 Dashboard → Open dashboard** opens it inside the sheet (modal), or
- **Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has access* **Anyone with the link** →
  copy the `/exec` URL. That URL is what you send a client.

Per-industry URLs: `/exec?demo=clinic`, `/exec?demo=gym`, `/exec?demo=lawfirm` …

### 5. Verify everything is wired up
**📊 Dashboard → Check sheet setup** prints one line per industry:

```
✅ Clinic · Dental — 3 tabs, all headings matched
⚠️ Law Firm — missing tabs: Legal · Time Entries
```

If a heading is "unmatched", the column simply reads as empty — nothing breaks. Fix by renaming
the column in the sheet or adding the spelling to the `a:` (aliases) array in `Code.gs`.

---

## Pointing it at a real client's sheet

`Code.gs` reads tabs by name and matches headings loosely (case, spaces, trailing `*`/`:` ignored,
plus a list of aliases per field). So a client's existing sheet usually works untouched:

| Their heading | Recognised as |
|---|---|
| `Invoice No` / `Ref` / `Reference` | invoice number |
| `Amount Paid` / `Total` / `Value` | amount |
| `Payment Date` / `Received On` | paid date |
| `Client Name` / `Customer` / `Account` | client |

Three ways to adapt:

1. **Rename tabs only.** Change `sheet: 'Leads'` to `sheet: 'Enquiries'` in the industry block.
2. **Rename nothing at all** — add their heading to the `a: []` aliases array:
   `C('amount', 'Amount', 'money', ['invoice value', 'billed'])`
3. **Standalone project** (script not bound to a sheet): set `SETTINGS.SHEET_ID` to their file ID.

---

## Settings worth knowing (`SETTINGS` at the top of `Code.gs`)

| Setting | Default | What it does |
|---|---|---|
| `CURRENCY` | `PKR` | Symbol used everywhere (`PKR`, `USD`, `EUR`, `AED`…) |
| `LOCALE` | `en-PK` | Number formatting |
| `DEFAULT_DEMO` | `agency` | Which industry a bare `/exec` opens |
| `TAB_PREFIX` | `true` | `Agency · Invoices` vs plain `Invoices` |
| `SHOW_SWITCHER` | `true` | `false` hides the industry dropdown for client installs |
| `RECENT_ROWS` | `8` | Rows in the recent-records table |
| `MONTHS_SHOWN` | `12` | Points in trend charts |
| `CACHE_SECONDS` | `0` | Set `120` on big sheets; menu item clears it |
| `COMPANY_NAME` | `''` | Client name in the header |

Seeding options (`SeedData.gs → SEED_CONFIG`): `MONTHS` (history depth), `SCALE` (× rows),
`SEED` (different dataset, same shape), `CONFIRM`, `FORMAT`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Menu missing after saving | Reload the sheet tab; `onOpen` only runs on open. |
| "Tab … not found" notice in the page | Run *Seed demo data*, or fix the tab name in `Code.gs`. |
| All zeros | Tabs exist but headings didn't match — run *Check sheet setup*. |
| `Exception: You do not have permission` | Approve the OAuth screen; then *Deploy → Manage deployments → edit → Deploy*. |
| Page loads but data is stale | `CACHE_SECONDS` is > 0. Use **Clear cache**. |
| Modal is cramped | Use the deployed `/exec` URL instead of the dialog. |
| Numbers look like text | Money cells must be numeric; `Rs 12,000` text is cleaned automatically, `12,000.50` is fine. |
