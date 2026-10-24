/**
 * build-portfolio.js
 * --------------------------------------------------------------------------------------------
 * Turns the payloads written by build-demos.js into the static portfolio page
 * (portfolio/index.html) — the site you upload to GitHub → Netlify / Cloudflare Pages.
 *
 *   node tools/build-portfolio.js
 *
 * Every card links to ../demos/NN_Name.html with target="_blank", so a dashboard always opens
 * in its own tab and the portfolio stays where it is.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const payloads = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'cache', 'payloads.json'), 'utf8'));

/* --- how the 30 demos are grouped on the page (order here = order on the page) --- */
const GROUPS = [
  ['Marketing & sales', ['agency', 'recruitment', 'printing']],
  ['Property & design', ['realestate', 'construction', 'archfirm']],
  ['Retail & food', ['ecommerce', 'restaurant', 'bakery', 'pharmacy', 'fuelstation']],
  ['Health & care', ['clinic', 'vetclinic']],
  ['Education & people', ['coaching', 'school']],
  ['Fitness, beauty & events', ['gym', 'salon', 'photography']],
  ['Travel & hospitality', ['travel', 'hotel']],
  ['Industrial & trades', ['factory', 'textile', 'poultry', 'autoshop', 'solar']],
  ['Technology & services', ['saas', 'msp', 'logistics', 'courier', 'lawfirm']],
];

const EMOJI = {
  agency: '🎯', realestate: '🏠', coaching: '🎓', ecommerce: '🛍️', restaurant: '☕', salon: '✂️',
  gym: '🏋️', school: '🏫', clinic: '🦷', travel: '✈️', construction: '🏗️', photography: '📸',
  saas: '☁️', logistics: '🚚', lawfirm: '⚖️', hotel: '🛏️', factory: '🏭', recruitment: '👥',
  pharmacy: '💊', poultry: '🐔', fuelstation: '⛽', msp: '🖥️', autoshop: '🔧', printing: '🖨️',
  textile: '👕', bakery: '🥖', courier: '📦', archfirm: '📐', vetclinic: '🐾', solar: '☀️',
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtMoney = n => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return 'Rs ' + (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (Math.abs(v) >= 1e6) return 'Rs ' + (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return 'Rs ' + Math.round(v / 1e3) + 'K';
  return 'Rs ' + Math.round(v);
};
const fmtNum = (n, dp) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: dp === undefined ? 0 : dp });

const value = k => {
  if (!k) return '';
  if (k.unit) return fmtNum(k.value, typeof k.dp === 'number' ? k.dp : (k.value % 1 ? 1 : 0)) + ' ' + k.unit;
  if (k.format === 'percent') return (k.value * 100).toFixed(k.value * 100 < 10 ? 1 : 0) + '%';
  if (k.format === 'money') return fmtMoney(k.value);
  if (k.format === 'days') return fmtNum(k.value) + ' days';
  if (k.format === 'hours') return fmtNum(k.value) + ' h';
  return fmtNum(k.value, k.value % 1 ? 1 : 0);
};

const fileFor = (c, i) =>
  `${String(i + 1).padStart(2, '0')}_${c.meta.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '')}.html`;

const byslug = {};
payloads.forEach((p, i) => { byslug[p.meta.slug] = { p, i, file: fileFor(p, i) }; });

const LAYOUT_LABEL = {
  grid: 'KPI grid', hero: 'Headline KPI', ledger: 'Ledger', gauge: 'Instrument strip',
  calendar: 'Daily charts + rail', scorecard: 'Scorecard', board: 'Board', timeline: 'Single column',
};

function card(slug, base) {
  const { p, i, file } = byslug[slug];
  const moneyKpi = p.kpis.find(k => k.format === 'money') || p.kpis[0];
  const accent = p.meta.accent;
  const layout = (p.meta.layout && p.meta.layout.preset) || 'grid';
  return `
    <a class="card" href="${base}demos/${file}" target="_blank" rel="noopener">
      <span class="thumb">
        <img src="${base}screenshots/${file.replace('.html', '.png')}" alt="${esc(p.meta.name)} dashboard preview" loading="lazy">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span class="open">Open live demo &rarr;</span>
      </span>
      <span class="body">
        <span class="head">
          <span class="mark" style="background:linear-gradient(140deg,${accent},${accent}bb)">${EMOJI[slug] || '📊'}</span>
          <h3>${esc(p.meta.name)}</h3>
        </span>
        <span class="tag">${esc(p.meta.tagline)}</span>
        <span class="metrics">${p.kpis.map(k => `<span>${esc(k.label)}</span>`).join('')}</span>
        <span class="footrow">
          <span class="rows">${fmtNum(p.meta.rows)} rows &middot; ${LAYOUT_LABEL[layout] || layout}</span>
          <span class="val">${value(moneyKpi)}<small>${esc(moneyKpi.label)}</small></span>
        </span>
      </span>
    </a>`;
}

const totalRows = payloads.reduce((s, p) => s + (p.meta.rows || 0), 0);
const layoutsUsed = new Set(payloads.map(p => (p.meta.layout || {}).preset || 'grid'));

const sectionsFor = base => GROUPS.map(([title, slugs]) => {
  const cards = slugs.filter(s => byslug[s]).map(sl => card(sl, base)).join('');
  return `
  <section class="group">
    <h2>${esc(title)} <span>${slugs.filter(s => byslug[s]).length}</span></h2>
    <div class="grid">${cards}
    </div>
  </section>`;
}).join('');

const pageFor = base => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Business Dashboard Suite &mdash; 30 industry demos</title>
<meta name="description" content="Thirty Google Sheets + Apps Script business dashboards: agency, real estate, clinic, restaurant, hotel, factory, pharmacy, poultry, fuel station, MSP, workshop, printing press, apparel, bakery, courier, design studio, vet, solar and more. Live demos, realistic sample data, no licences.">
<meta property="og:title" content="Business Dashboard Suite — 30 industry demos">
<meta property="og:description" content="A working dashboard per industry, each fed by one Google Sheet. Built with Apps Script and a single HTML file.">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%237c6cf7'/><path d='M24 70l14-18 10 10 18-24 10 8' stroke='white' stroke-width='7' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>">
<style>
:root{
  --bg:#070b16; --surface:#0f1626; --surface-2:#131c2f; --line:#1e2942;
  --ink:#eef2fb; --ink-2:#c3cce0; --muted:#8e9bb5;
  --brand:#7c6cf7; --brand-2:#a78bfa; --ok:#34d399;
  --radius:20px;
  --font:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(1100px 600px at 10% -10%, rgba(124,108,247,.22), transparent 70%),
    radial-gradient(900px 520px at 95% 0%, rgba(14,165,233,.14), transparent 68%);}
.wrap{max-width:1280px;margin:0 auto;padding:34px 24px 70px}
a{color:inherit;text-decoration:none}
h1,h2,h3,p{margin:0}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:640;letter-spacing:.14em;
  text-transform:uppercase;color:var(--brand-2);background:rgba(124,108,247,.12);
  border:1px solid rgba(124,108,247,.28);padding:6px 12px;border-radius:999px}
.hero{margin:22px 0 30px;max-width:860px}
.hero h1{font-size:clamp(30px,4.4vw,50px);line-height:1.06;font-weight:740;letter-spacing:-.035em}
.hero h1 em{font-style:normal;background:linear-gradient(100deg,#a78bfa,#38bdf8);-webkit-background-clip:text;
  background-clip:text;color:transparent}
.hero p{margin-top:16px;color:var(--ink-2);font-size:15.5px;max-width:68ch}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;min-width:118px}
.stat b{display:block;font-size:19px;letter-spacing:-.02em}
.stat span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.group{margin-top:34px}
.group h2{font-size:13px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);
  display:flex;align-items:center;gap:9px;margin-bottom:14px}
.group h2 span{font-size:10.5px;font-weight:700;letter-spacing:0;color:var(--brand-2);
  background:rgba(124,108,247,.14);border:1px solid rgba(124,108,247,.28);border-radius:999px;padding:1px 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;
  transition:transform .22s cubic-bezier(.2,.7,.3,1),border-color .22s,box-shadow .22s;display:flex;flex-direction:column}
.card:hover{transform:translateY(-4px);border-color:#2b3a5c;box-shadow:0 26px 60px -30px rgba(0,0,0,.9)}
.thumb{position:relative;aspect-ratio:16/10.4;background:var(--surface-2);border-bottom:1px solid var(--line);
  overflow:hidden;display:block}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;
  transition:transform .5s cubic-bezier(.2,.7,.3,1)}
.card:hover .thumb img{transform:scale(1.03)}
.thumb .num{position:absolute;left:12px;top:12px;font-size:10.5px;font-weight:700;letter-spacing:.08em;
  background:rgba(7,11,22,.82);color:#fff;padding:4px 9px;border-radius:8px}
.thumb .open{position:absolute;right:12px;bottom:12px;font-size:11px;font-weight:640;color:#fff;
  background:rgba(7,11,22,.85);padding:5px 10px;border-radius:8px;
  opacity:0;transform:translateY(4px);transition:.2s}
.card:hover .thumb .open{opacity:1;transform:none}
.body{padding:15px 16px 16px;display:flex;flex-direction:column;gap:9px;flex:1}
.head{display:flex;align-items:center;gap:10px}
.mark{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:0 0 32px;font-size:15px}
.body h3{font-size:14.5px;font-weight:660;letter-spacing:-.015em}
.body .tag{font-size:11.5px;color:var(--muted);line-height:1.45;min-height:34px}
.metrics{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto}
.metrics span{font-size:10px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);
  padding:3px 7px;border-radius:6px;white-space:nowrap}
.footrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:9px;
  border-top:1px solid var(--line);margin-top:4px}
.footrow .rows{font-size:10.5px;color:var(--muted)}
.footrow .val{font-size:12px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.footrow .val small{font-weight:500;color:var(--muted);font-size:10px;margin-left:4px}
.howto{margin-top:56px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:26px}
.howto h2{font-size:20px;font-weight:700;letter-spacing:-.025em}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:18px}
.cols h3{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--brand-2);margin-bottom:6px}
.cols p{font-size:13px;color:var(--ink-2)}
footer{margin-top:34px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;
  font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:18px}
code{background:rgba(148,163,184,.14);padding:1px 5px;border-radius:5px;font-size:.92em}
@media(max-width:600px){.wrap{padding:22px 14px 50px}.grid{grid-template-columns:1fr}.hero p{font-size:14.5px}}
</style>
</head>
<body>
<div class="wrap">

  <span class="eyebrow">Google Sheets &middot; Apps Script &middot; HTML</span>

  <div class="hero">
    <h1>Thirty dashboards.<br><em>One spreadsheet</em> each.</h1>
    <p>
      Every demo below is a working dashboard fed by a Google Sheet &mdash; no Looker Studio licence,
      no connectors, no per-seat pricing. Each trade gets its own layout, its own measuring units and
      the six numbers that actually decide its week, with ${fmtNum(totalRows)} rows of seasonal,
      benchmark-checked sample data behind it.
    </p>
    <div class="stats">
      <div class="stat"><b>30</b><span>Industries</span></div>
      <div class="stat"><b>${fmtNum(totalRows)}</b><span>Sample rows</span></div>
      <div class="stat"><b>6</b><span>KPIs each</span></div>
      <div class="stat"><b>${layoutsUsed.size}</b><span>Layouts</span></div>
      <div class="stat"><b>18</b><span>Months history</span></div>
      <div class="stat"><b>0</b><span>Dependencies</span></div>
    </div>
  </div>
${sectionsFor(base)}

  <div class="howto">
    <h2>How this is deployed</h2>
    <div class="cols">
      <div>
        <h3>1 &middot; Host the demos</h3>
        <p>This folder is a static site. Push it to GitHub, then connect the repo to Netlify
        (or Cloudflare Pages) &mdash; build command empty, publish directory <code>.</code>.
        Every card opens its dashboard in a new tab.</p>
      </div>
      <div>
        <h3>2 &middot; Install a real client</h3>
        <p>Copy <code>Code.gs</code>, <code>SeedData.gs</code> and <code>Index.html</code> into a
        Google Sheet's Apps Script editor, run the seeder once, then deploy as a web app.</p>
      </div>
      <div>
        <h3>3 &middot; Swap the data</h3>
        <p>Headings, tab names and the currency all live in <code>SETTINGS</code>. Point it at the
        client's own tabs and the same dashboard starts reporting their numbers.</p>
      </div>
    </div>
  </div>

  <footer>
    <span>Business Dashboard Suite &middot; 30 industries &middot; built with Google Apps Script</span>
    <span>Sample data is generated, not real client data.</span>
  </footer>
</div>
</body>
</html>
`;

/* ================================================================================================
 * WRITE THE SITE
 * ------------------------------------------------------------------------------------------------
 * index.html at the REPO ROOT is the deployable site (Cloudflare Pages / Netlify / GitHub Pages all
 * serve the repo root). Its paths are  demos/…  and  screenshots/…  — no "../", because the page is
 * served from "/".
 *
 * portfolio/index.html is the same page with ../ paths, kept so the folder still browses correctly
 * when you open it straight off disk (file://…/portfolio/index.html) or inside the ZIP.
 * ============================================================================================== */

fs.writeFileSync(path.join(ROOT, 'index.html'), pageFor(''));
fs.mkdirSync(path.join(ROOT, 'portfolio'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'portfolio', 'index.html'), pageFor('../'));

/* Cloudflare Pages reads _headers (caching + security) and 404.html straight from the output dir. */
fs.writeFileSync(path.join(ROOT, '_headers'), `# Cloudflare Pages headers — https://developers.cloudflare.com/pages/configuration/headers/
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=()

# demo pages and the portfolio change whenever you rebuild — never serve a stale copy
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# screenshots are content-addressed by filename; they can be cached hard
/screenshots/*
  Cache-Control: public, max-age=31536000, immutable
`);

/* Portfolio folder still exists in the repo (for offline browsing) — point crawlers at the root. */
fs.writeFileSync(path.join(ROOT, '_redirects'), `# Cloudflare Pages redirects — https://developers.cloudflare.com/pages/configuration/redirects/
# The deployed site is /index.html; the duplicate under /portfolio is for browsing off disk.
/portfolio          /   301
/portfolio/index.html  /   301
`);

fs.writeFileSync(path.join(ROOT, '404.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found &mdash; Business Dashboard Suite</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b16;color:#eef2fb;
    font-family:"Inter",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center;padding:24px}
  h1{font-size:clamp(26px,5vw,40px);letter-spacing:-.03em;margin:0 0 10px}
  p{color:#8e9bb5;margin:0 0 22px;font-size:15px}
  a{display:inline-block;background:linear-gradient(140deg,#7c6cf7,#38bdf8);color:#fff;
    padding:11px 20px;border-radius:11px;text-decoration:none;font-weight:600;font-size:14px}
</style></head>
<body><div>
  <h1>That demo moved</h1>
  <p>The industry switcher inside every dashboard lists all ${payloads.length}, or start from the index.</p>
  <a href="/">Back to all ${payloads.length} dashboards</a>
</div></body></html>
`);

console.log(`index.html (repo root)      : ${payloads.length} cards, ${GROUPS.length} groups, ${fmtNum(totalRows)} rows`);
console.log(`portfolio/index.html        : same page with ../ paths for offline browsing`);
console.log(`_headers, 404.html          : Cloudflare Pages ready`);
