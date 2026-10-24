# tools/ — rebuilding the demos and the portfolio

Not part of what a client installs. These two scripts exist so the 30 demo pages and the portfolio
are always generated from the *same* Apps Script code a client receives — never hand-edited.

```bash
cd business-dashboard-suite
npm init -y && npm i -D playwright@1.47.2 && npx playwright install chromium

node tools/build-demos.js       # seed → validate → demos/*.html → screenshots/*.png
SKIP_SHOTS=1 node tools/build-demos.js   # skip the browser (fast, data only)
python3 tools/make-thumbs.py    # screenshots → thumbs/*.webp (760px, ~21 KB) + assets/ portrait sizes
node tools/build-portfolio.js   # payloads → index.html + portfolio/index.html + _headers + 404
```

What `build-demos.js` does:

1. Loads `Code.gs` + `SeedData.gs` into Node with a fake Google Sheets API and the Apps Script stubs
   (`Utilities.formatDate`, `Session`, `SpreadsheetApp`, `HtmlService`, `CacheService`).
2. Runs the real seeder for all 30 industries.
3. Calls the real `getDashboardData()` for each one and validates: 6 KPIs, 3 charts, a populated
   table, no `NaN` anywhere, a layout preset declared.
4. Writes one self-contained HTML per industry into `demos/`, with the payload embedded as
   `window.DEMO_PAYLOAD` and the industry switcher wired across all 30 files.
5. Screenshots each demo at 1440×1050 @2× into `screenshots/`.

Outputs: `tools/cache/payloads.json` (the intermediate data), `demos/`, `screenshots/`.

**Note on filesystem snapshots:** this folder is `tools/` and not `build/` for a reason — a directory
literally named `build` is excluded from some workspace snapshots, which is how the first version of
this script went missing.

Requirements: Node 18+, and Chromium's system libraries on Linux
(`libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libatspi2.0-0 libxdamage1
libxcomposite1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`).
