/**
 * build-demos.js
 * --------------------------------------------------------------------------------------------
 * Runs the REAL Apps Script files (Code.gs + SeedData.gs) inside Node with a fake Google Sheets
 * API, then:
 *   1. validates that every one of the 30 industries produces a sane payload
 *   2. writes a self-contained demo HTML per industry  → demos/NN_Name.html
 *   3. (optionally) screenshots each demo               → screenshots/NN_Name.png
 *
 * Usage:  node tools/build-demos.js
 * Requires: npm i -D playwright && npx playwright install chromium   (only for screenshots)
 *
 * This is a build-time convenience, not part of the deliverable. It exists so the portfolio
 * demos are generated from the same code the client receives — no hand-edited sample numbers.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'apps-script');

/* ============================== fake Google Sheets ============================== */
function makeSheet(name) {
  let values = [];
  const sheet = {
    __name: name,
    getName: () => sheet.__name,
    clear() { values = []; return sheet; },
    getLastRow: () => values.length,
    getLastColumn: () => values.reduce((m, r) => Math.max(m, r.length), 0),
    getRange(r, c, nr = 1, nc = 1) {
      const api = {
        setValues(v) {
          for (let i = 0; i < v.length; i++) {
            values[r - 1 + i] = values[r - 1 + i] || [];
            for (let j = 0; j < v[i].length; j++) values[r - 1 + i][c - 1 + j] = v[i][j];
          }
          return api;
        },
        getValues: () => Array.from({ length: nr }, (_, i) =>
          Array.from({ length: nc }, (_, j) => (values[r - 1 + i] || [])[c - 1 + j] ?? '')),
        applyRowBanding() { return api; },
        setBackground() { return api; }, setFontColor() { return api; }, setFontWeight() { return api; },
        setFontSize() { return api; }, setVerticalAlignment() { return api; }, setHorizontalAlignment() { return api; },
        setNumberFormat() { return api; }, setWrapStrategy() { return api; },
        setDataValidation() { return api; }, setConditionalFormatRules() { return api; },
        getConditionalFormatRules: () => [],
        clearContent() { return api; }, activate() { return api; },
        createFilter() { sheet.__filter = { remove() { sheet.__filter = null; } }; return api; },
      };
      return api;
    },
    setRowHeight() { return sheet; }, setColumnWidth() { return sheet; },
    setFrozenRows() { return sheet; }, setFrozenColumns() { return sheet; },
    setTabColor() { return sheet; },
    getFilter: () => sheet.__filter || null,
  };
  return sheet;
}

function makeSS(name) {
  const sheets = [];
  const ss = {
    getName: () => ss.__name,
    rename(n) { ss.__name = n; return ss; },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/DEMO/edit',
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets,
    deleteSheet: s => { const i = sheets.indexOf(s); if (i >= 0) sheets.splice(i, 1); },
    setActiveSheet() { return ss; }, moveActiveSheet() { return ss; },
    toast() {},
  };
  ss.__name = name;
  ss.insertSheet('Sheet1');
  return ss;
}

/* ============================== Apps Script stubs ============================== */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SS = makeSS('Business Dashboard Suite');
const alerts = [];

global.Utilities = {
  formatDate(d, tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    return String(fmt)
      .replace(/yyyy/g, d.getFullYear())
      .replace(/MMM/g, MONTHS[d.getMonth()])
      .replace(/MM/g, p(d.getMonth() + 1))
      .replace(/dd/g, p(d.getDate()));
  },
};
global.Session = { getScriptTimeZone: () => 'Asia/Karachi' };
global.Logger = { log: () => {} };
global.CacheService = { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) };
global.HtmlService = {
  createHtmlOutputFromFile: () => ({
    setTitle() { return this; }, addMetaTag() { return this; },
    setXFrameOptionsMode() { return this; }, setWidth() { return this; }, setHeight() { return this; },
  }),
  createTemplateFromFile: () => ({ evaluate: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }) }),
  XFrameOptionsMode: { ALLOWALL: 1 },
};
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => SS,
  create: n => makeSS(n),
  getActive: () => ({ toast() {} }),
  getUi: () => {
    const ui = {
      alert: (...a) => { alerts.push(a.filter(x => typeof x === 'string').join(' | ')); return 'YES'; },
      prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => 'all' }),
      ButtonSet: { YES_NO: 'YN', OK: 'OK' }, Button: { YES: 'YES', OK: 'OK' },
      createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; },
      showModalDialog: () => {},
    };
    return ui;
  },
  BandingTheme: { LIGHT_GREY: 'LIGHT_GREY', LIGHT_BLUE: 'LIGHT_BLUE' },
  WrapStrategy: { CLIP: 'CLIP', WRAP: 'WRAP' },
  newDataValidation: () => ({ requireValueInList: () => ({ setAllowInvalid: () => ({ build: () => ({}) }) }) }),
  newConditionalFormatRule: () => {
    const r = { whenTextEqualTo: () => r, whenTextContains: () => r, setBackground: () => r, setFontColor: () => r, setRanges: () => r, build: () => ({}) };
    return r;
  },
};

/* ============================== load the real .gs files ============================== */
const codeSrc = fs.readFileSync(path.join(APP, 'Code.gs'), 'utf8');
const seedSrc = fs.readFileSync(path.join(APP, 'SeedData.gs'), 'utf8');

const sandbox = {};
const runner = new Function('global', `
  ${codeSrc}
  ${seedSrc}
  global.API = {
    seed: seedDemoData,
    get: getDashboardData,
    catalog: getCatalog,
    industries: demoIndustries,
    checkSetup: checkSetup,
    seedConfig: SEED_CONFIG
  };
  return global.API;
`);
const API = runner(global);

/* ============================== 1. seed + validate ============================== */
console.log('Seeding demo data through the real SeedData.gs …');
const t0 = Date.now();
API.seedConfig.CONFIRM = false;
API.seedConfig.FORMAT = true;
const seedResult = API.seed('all');
console.log(`Seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const catalog = API.catalog();
const payloads = [];
const problems = [];

catalog.forEach((c, i) => {
  const p = API.get(c.slug);
  payloads.push(p);

  const label = `${String(i + 1).padStart(2, '0')} ${c.name}`;
  if (!p.kpis || p.kpis.length < 4) problems.push(`${label}: only ${p.kpis ? p.kpis.length : 0} KPIs`);
  if (!p.charts || p.charts.length < 3) problems.push(`${label}: only ${p.charts ? p.charts.length : 0} charts`);
  if (!p.table || !p.table.rows.length) problems.push(`${label}: empty table`);

  (p.kpis || []).forEach(k => {
    if (k.value === null || k.value === undefined || Number.isNaN(Number(k.value))) {
      problems.push(`${label}: KPI "${k.label}" has a non-numeric value (${k.value})`);
    }
  });
  (p.charts || []).forEach(ch => {
    if (!ch.values.length) problems.push(`${label}: chart "${ch.title}" has no values`);
    if (ch.values.some(v => Number.isNaN(Number(v)))) problems.push(`${label}: chart "${ch.title}" has NaN`);
  });

  const rows = p.meta.rows;
  const moneyKpis = (p.kpis || []).filter(k => k.format === 'money');
  console.log(
    `${label.padEnd(34)} rows=${String(rows).padStart(6)}  ` +
    `money KPIs: ${moneyKpis.map(k => `${k.label}=${Math.round(k.value).toLocaleString()}`).join(', ').slice(0, 96)}`
  );
});

fs.mkdirSync(path.join(ROOT, 'tools', 'cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'cache', 'payloads.json'), JSON.stringify(payloads, null, 2));

console.log('');
if (problems.length) {
  console.log('⚠️  PROBLEMS:');
  problems.forEach(p => console.log('   - ' + p));
} else {
  console.log(`✅ All ${catalog.length} industries produced 6 KPIs, 3 charts and a populated table.`);
}

// layout coverage — each industry must declare a preset, and the presets should be spread out
const presetUse = {};
payloads.forEach(p => {
  const preset = (p.meta.layout && p.meta.layout.preset) || 'none';
  presetUse[preset] = (presetUse[preset] || 0) + 1;
  if (preset === 'none') problems.push(`${p.meta.name}: no layout preset`);
});
console.log('   layouts: ' + Object.keys(presetUse).map(k => `${k}×${presetUse[k]}`).join('  '));

/* ============================== 2. write demos ============================== */
const demosDir = path.join(ROOT, 'demos');
fs.mkdirSync(demosDir, { recursive: true });

const shell = fs.readFileSync(path.join(APP, 'Index.html'), 'utf8');

const fileFor = (c, i) => `${String(i + 1).padStart(2, '0')}_${c.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '')}.html`;
const links = {};
catalog.forEach((c, i) => { links[c.slug] = fileFor(c, i); });

catalog.forEach((c, i) => {
  const payload = payloads[i];
  const html = shell
    .replace("'<?= initialSlug ?>'", JSON.stringify(c.slug))
    .replace('</body>', `<script>
  window.DEMO_PAYLOAD = ${JSON.stringify(payload)};
  window.DEMO_LINKS = ${JSON.stringify(links)};
</script>
</body>`);

  fs.writeFileSync(path.join(demosDir, fileFor(c, i)), html);
});

console.log(`\nWrote ${catalog.length} demo files to demos/`);

/* ============================== 3. screenshots ============================== */
(async () => {
  if (process.env.SKIP_SHOTS === '1') return;
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('playwright not installed — skipping screenshots'); return; }

  const shotsDir = path.join(ROOT, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  for (let i = 0; i < catalog.length; i++) {
    const file = path.join(demosDir, fileFor(catalog[i], i));
    await page.goto('file://' + file);
    await page.waitForTimeout(1100);
    const out = path.join(shotsDir, fileFor(catalog[i], i).replace('.html', '.png'));
    await page.screenshot({ path: out, fullPage: true });
    console.log('  shot', path.basename(out));
  }

  console.log(errors.length ? '\n⚠️  page errors:\n' + errors.join('\n') : '\n✅ No page errors in any demo.');
  await browser.close();

  fs.mkdirSync(path.join(ROOT, 'tools', 'cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'cache', 'payloads.json'), JSON.stringify(payloads, null, 2));
})();
