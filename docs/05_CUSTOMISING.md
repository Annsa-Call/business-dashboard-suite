# 05 · Customising

Everything is plain JavaScript with comments. No build step, no dependencies.

---

## Change a metric, label or colour

| I want to… | Edit |
|---|---|
| Rename a KPI | the first argument of `KPI('Label', value, {…})` in that industry block |
| Change a number's tone | `{ tone: 'ok' \| 'warn' \| 'danger' \| 'info' \| 'brand' }` |
| Swap a chart | `CHART('line'\|'bars'\|'donut'\|'hbars', title, subtitle, labels, values, {format})` |
| Change the table | `TABLE(title, subtitle, rows, dateField, columns, { withinDays: 150, futureDays: 0 })` |
| Change a column heading | `C('key', 'Heading', 'type', ['alias1','alias2'])` |
| Use USD | `SETTINGS.CURRENCY = 'USD'` and `SEED_CONFIG.CURRENCY_FORMAT = '"$" #,##0'` |
| Hide the switcher for a client | `SETTINGS.SHOW_SWITCHER = false` |
| Plain tab names | `SETTINGS.TAB_PREFIX = false` |
| More/fewer demo rows | `SEED_CONFIG.SCALE` (2 = double), or per-tab in `SEED_ROWS` |
| Different dataset, same shape | change `SEED_CONFIG.SEED` |

## Add a 16th industry (about 80 lines)

1. **Copy an existing block** in `Code.gs` (say `clinic`) and paste it at the end of `INDUSTRIES`.
2. Give it a new `slug`, `name`, `short` (short = tab prefix, keep it under 8 characters),
   `icon` (any key from the `I` map in Index.html), `accent` colour, `tagline`, `pitch`.
3. Rewrite `tabs`: the tab names and the `C(...)` column definitions.
4. Rewrite `dashboard: function (T) { ... }`: compute six numbers and return
   `{ kpis: [...], charts: [...], table: TABLE(...) }`.
5. Add a generator in `SeedData.gs`:
   ```js
   function genMyIndustry_(rows) {
     return { invoices: [ /* [date, client, amount, due, paid, status] */ ] };
   }
   var SEED_GENERATORS = { ..., myindustry: genMyIndustry_ };
   ```
   Row order **must** match the `C(...)` order in `Code.gs`.
6. Add row counts: `SEED_ROWS.myindustry = { invoices: 400 }`.
7. Run `seedDemoData('myindustry')`, then `getDashboardData('myindustry')`.

> Faster path for a one-off client: keep their sheet, delete every industry except one from
> `INDUSTRIES`, and edit that block's `tabs` to match their headings.

## Using the UI outside Apps Script

`demos/*.html` are examples: the shell plus a `window.DEMO_PAYLOAD` object. To host the dashboard
on your own site with static data, embed a payload:

```html
<script>
window.DEMO_PAYLOAD = { meta: {...}, kpis: [...], charts: [...], table: {...} };
</script>
```

To pull live JSON from any API instead of Google Sheets, replace the `boot()` branch in
`Index.html`:

```js
fetch('/api/dashboard').then(r => r.json()).then(onData).catch(onError);
```

The payload contract (`meta / kpis / charts / table / catalog / notices`) is documented at the top
of both `Code.gs` and `Index.html`.

## Performance

| Situation | What to do |
|---|---|
| Sheet > 10k rows | `SETTINGS.CACHE_SECONDS = 120`; use **Clear cache** when you edit the sheet |
| 30 industries in one file | Only the selected industry is read per request — leave it |
| Slow first load | Normal: Apps Script cold start. Subsequent loads are ~1s |
| Table too wide on mobile | Remove a column from the `TABLE(...)` array; the table scrolls horizontally |


---

## Layouts (v2) — why industries don't all look the same

Every industry declares a layout next to its colours:

```js
{
  slug: 'hotel', name: 'Boutique Hotel · Islamabad',
  icon: 'bed', accent: '#0891b2',
  layout: { preset: 'hero', kpiCols: 3 },     // ← this is the whole design decision
  ...
}
```

`preset` is one of eight arrangements, defined in `Index.html` §4b:

| preset | What the page looks like | Good for |
|---|---|---|
| `grid` | the classic 3-up KPI grid, 3 charts, table | general businesses |
| `hero` | first KPI becomes a 2×2 headline panel | one number that *is* the business (occupancy, utilisation) |
| `ledger` | KPI stack on the left, transaction table on the right, charts underneath | anything with an invoice/ledger at its centre |
| `gauge` | six compact instrument tiles across the top | machine/throughput businesses (plant, workshop) |
| `calendar` | daily charts stacked wide, KPI rail down the right | day-by-day operations (pharmacy, bakery, salon) |
| `scorecard` | table pinned right and full-height, numbers and charts left | order books and registers (apparel, poultry, logistics) |
| `board` | the records table leads; KPI strip reads along the bottom | shift logs (fuel station, solar) |
| `timeline` | one vertical reading column, top to bottom | SLA/process narratives (MSP, courier, construction) |

Optional knobs:

```js
layout: { preset: 'gauge', kpiCols: 6 }        // force the tile count
layout: { preset: 'grid',  chartCols: '1.4fr 1fr 1fr' }
```

Anything you leave out falls back to the preset's default. Below 1180 px every preset collapses to a
single column, so mobile never breaks (verified at 390 px).

### Units that aren't rupees

KPI values can carry a free-form unit instead of a currency:

```js
KPI('Feed Conversion (FCR)', fcr, { format: 'number', dp: 2, icon: 'activity' })
KPI('Dealer Margin', 9.98,        { format: 'number', dp: 2, unit: 'Rs/L' })
KPI('Good Output · MTD', pieces,  { format: 'number', unit: 'pcs' })
KPI('Cost per Watt', 108.81,      { format: 'number', dp: 2, unit: 'Rs/W' })
KPI('Average Length of Stay', 2.3,{ format: 'number', dp: 1, unit: 'nights' })
```

`unit` prints small after the number; `dp` controls decimals. That is how the suite reports kWh, kW,
litres, kilograms, impressions, minutes, days and per-100 defect rates without pretending everything
is money.

### Adding a 31st industry

1. Copy any industry object in `Code.gs` (§6) and change `slug`, `name`, `icon`, `accent`, `layout`.
2. Declare `tabs` (each `sheet` name + `cols` with loose aliases).
3. Write `dashboard: function (T) { ... }` returning `{ kpis, charts, table }`.
4. Add a generator in `SeedData.gs` (§5) and register it in `SEED_GENERATORS` + `SEED_ROWS`.
5. `node tools/build-demos.js && node tools/build-portfolio.js`.
