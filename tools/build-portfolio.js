/**
 * build-portfolio.js
 * --------------------------------------------------------------------------------------------
 * Turns the payloads written by build-demos.js into the static portfolio site:
 *
 *     index.html            ← the deployed page (paths relative to the repo root)
 *     portfolio/index.html  ← same page with ../ paths, for opening straight off disk
 *     _headers, _redirects, 404.html
 *
 *   node tools/build-demos.js      # payloads + screenshots
 *   python3 tools/make-thumbs.py   # 760px WebP thumbnails + portrait sizes
 *   node tools/build-portfolio.js  # this file
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const payloads = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'cache', 'payloads.json'), 'utf8'));
const thumbs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'cache', 'thumbs.json'), 'utf8'));

/* ================================================================================================
 * YOUR DETAILS — edit this block, re-run the script, push. Nothing else needs touching.
 * Leave any link empty ('') and its button simply doesn't render.
 * ============================================================================================== */
const PROFILE = {
  name: 'Ammar',
  role: 'Dashboards & reporting · Google Sheets + Apps Script',
  location: 'Karachi, Pakistan',
  email: 'ammarthemediamanager@gmail.com',
  whatsapp: '',        // digits only, with country code, e.g. '923001234567'
  instagram: '',       // full URL, e.g. 'https://instagram.com/yourhandle'
  linkedin: '',        // full URL
  photo: 'assets/ammar-320.webp',
  photo2x: 'assets/ammar-640.webp',
  available: true,
};

/* how the 30 demos are grouped (order here = order on the page) */
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

const LAYOUT_LABEL = {
  grid: 'KPI grid', hero: 'Headline KPI', ledger: 'Ledger', gauge: 'Instrument strip',
  calendar: 'Daily charts + rail', scorecard: 'Scorecard', board: 'Board', timeline: 'Single column',
};

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function card(slug, base) {
  const { p, i, file } = byslug[slug];
  const stem = file.replace('.html', '');
  const th = thumbs[stem];
  const moneyKpi = p.kpis.find(k => k.format === 'money') || p.kpis[0];
  const accent = p.meta.accent;
  const layout = (p.meta.layout && p.meta.layout.preset) || 'grid';
  return `
    <a class="card" href="${base}demos/${file}" target="_blank" rel="noopener">
      <span class="thumb">
        <img src="${base}${th.file}" srcset="${base}${th.file} 1x" width="${th.w}" height="${th.h}"
             alt="${esc(p.meta.name)} dashboard preview" loading="lazy" decoding="async"
             style="background-image:url('${th.lqip}');background-size:cover;background-position:top center">
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

const sectionsFor = base => GROUPS.map(([title, slugs]) => {
  const cards = slugs.filter(s => byslug[s]).map(sl => card(sl, base)).join('');
  return `
  <section class="group">
    <h2>${esc(title)} <span>${slugs.filter(s => byslug[s]).length}</span></h2>
    <div class="grid">${cards}
    </div>
  </section>`;
}).join('');

/* contact buttons — rendered only when the field is filled in */
const contactLinks = () => {
  const out = [];
  if (PROFILE.email) out.push({ href: 'mailto:' + PROFILE.email, label: 'Email me', cls: 'btn primary' });
  if (PROFILE.whatsapp) out.push({ href: 'https://wa.me/' + PROFILE.whatsapp, label: 'WhatsApp', cls: 'btn' });
  if (PROFILE.instagram) out.push({ href: PROFILE.instagram, label: 'Instagram', cls: 'btn', ext: true });
  if (PROFILE.linkedin) out.push({ href: PROFILE.linkedin, label: 'LinkedIn', cls: 'btn', ext: true });
  return out.map(b => `<a class="${b.cls}" href="${b.href}"${b.ext ? ' target="_blank" rel="noopener"' : ''}>${b.label}</a>`).join('');
};

const totalRows = payloads.reduce((s, p) => s + (p.meta.rows || 0), 0);
const layoutsUsed = new Set(payloads.map(p => (p.meta.layout || {}).preset || 'grid'));
const avail = PROFILE.available
  ? '<span class="avail"><span class="dot"></span>Available for new work</span>'
  : '<span class="avail busy"><span class="dot"></span>Currently booked</span>';

const pageFor = base => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ammar — Business Dashboard Portfolio · 30 industry demos</title>
<meta name="description" content="Portfolio of Ammar, a Karachi-based dashboard developer. Thirty working business dashboards built with Google Sheets, Apps Script and one HTML file — hotel RevPAR, factory OEE, pharmacy stock cover, poultry FCR and more. Live demos, no licences, no per-seat fees.">
<meta name="author" content="Ammar">
<meta name="theme-color" content="#070b16">
<meta property="og:title" content="Ammar — Business Dashboard Portfolio · 30 industries">
<meta property="og:description" content="Thirty working dashboards, one Google Sheet each. Every trade gets its own layout, its own units and its own six numbers.">
<meta property="og:type" content="profile">
<meta property="og:image" content="${base}${thumbs['01_Digital-Marketing-Agency'].file}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%237c6cf7'/><path d='M24 70l14-18 10 10 18-24 10 8' stroke='white' stroke-width='7' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>">
<link rel="preload" as="image" href="${base}${PROFILE.photo}" type="image/webp">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Person","name":"${esc(PROFILE.name)}",
 "jobTitle":"Dashboard developer","address":{"@type":"PostalAddress","addressLocality":"Karachi","addressCountry":"PK"},
 "email":"${esc(PROFILE.email)}",
 "description":"Builds business dashboards on Google Sheets and Apps Script for clinics, factories, hotels, pharmacies and other trades.",
 "knowsAbout":["Google Apps Script","Google Sheets","Business intelligence","KPI design","Data visualisation"]}
</script>
<style>
:root{
  --bg:#070b16; --surface:#0f1626; --surface-2:#131c2f; --line:#1e2942;
  --ink:#eef2fb; --ink-2:#c3cce0; --muted:#8e9bb5;
  --brand:#7c6cf7; --brand-2:#a78bfa; --ok:#34d399;
  --radius:20px;
  --font:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(1100px 600px at 10% -10%, rgba(124,108,247,.22), transparent 70%),
    radial-gradient(900px 520px at 95% 0%, rgba(14,165,233,.14), transparent 68%);}
.wrap{max-width:1280px;margin:0 auto;padding:30px 24px 70px}
a{color:inherit;text-decoration:none}
h1,h2,h3,p{margin:0}
img{max-width:100%}

/* ---------------- top bar ---------------- */
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:26px}
.who{display:flex;align-items:center;gap:11px;min-width:0}
.who img{width:44px;height:44px;border-radius:13px;object-fit:cover;
  box-shadow:0 0 0 1px rgba(255,255,255,.14),0 8px 22px -10px rgba(0,0,0,.8)}
.who b{display:block;font-size:14px;font-weight:680;letter-spacing:-.01em;line-height:1.2}
.who span{display:block;font-size:11.5px;color:var(--muted);line-height:1.3}
.top nav{display:flex;gap:6px;flex-wrap:wrap}
.top nav a{font-size:12.5px;font-weight:560;color:var(--ink-2);padding:7px 12px;border-radius:9px;
  border:1px solid transparent;transition:background .15s,border-color .15s}
.top nav a:hover{background:var(--surface);border-color:var(--line)}

/* ---------------- hero ---------------- */
.hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:38px;align-items:center;margin:10px 0 34px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:640;letter-spacing:.14em;
  text-transform:uppercase;color:var(--brand-2);background:rgba(124,108,247,.12);
  border:1px solid rgba(124,108,247,.28);padding:6px 12px;border-radius:999px}
.hero h1{font-size:clamp(30px,4.2vw,50px);line-height:1.05;font-weight:740;letter-spacing:-.035em;margin-top:16px}
.hero h1 em{font-style:normal;background:linear-gradient(100deg,#a78bfa,#38bdf8);-webkit-background-clip:text;
  background-clip:text;color:transparent}
.hero .lede{margin-top:16px;color:var(--ink-2);font-size:15.5px;max-width:62ch}
.hero .lede b{color:var(--ink);font-weight:640}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.btn{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:620;
  padding:11px 18px;border-radius:11px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);
  transition:transform .15s,border-color .15s,background .15s}
.btn:hover{transform:translateY(-1px);border-color:#2b3a5c;background:var(--surface-2)}
.btn.primary{background:linear-gradient(140deg,#7c6cf7,#4f8ff7);border-color:transparent;color:#fff;
  box-shadow:0 14px 30px -14px rgba(124,108,247,.9)}
.btn.primary:hover{filter:brightness(1.07)}

/* portrait card */
.portrait{position:relative;background:linear-gradient(180deg,var(--surface),var(--surface-2));
  border:1px solid var(--line);border-radius:22px;padding:16px;text-align:center;
  box-shadow:0 30px 70px -40px rgba(0,0,0,1)}
.portrait img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;display:block}
.portrait b{display:block;margin-top:13px;font-size:15px;font-weight:680;letter-spacing:-.01em}
.portrait span.role{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.portrait .loc{display:block;font-size:11px;color:var(--faint,#6b7893);margin-top:6px}
.avail{display:inline-flex;align-items:center;gap:6px;margin-top:11px;font-size:10.5px;font-weight:640;
  text-transform:uppercase;letter-spacing:.06em;color:var(--ok);background:rgba(52,211,153,.1);
  border:1px solid rgba(52,211,153,.3);padding:4px 10px;border-radius:999px}
.avail .dot{width:6px;height:6px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(52,211,153,.18)}
.avail.busy{color:#f5b942;background:rgba(245,185,66,.1);border-color:rgba(245,185,66,.3)}
.avail.busy .dot{background:#f5b942}

/* stats */
.stats{display:flex;flex-wrap:wrap;gap:10px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;min-width:112px}
.stat b{display:block;font-size:19px;letter-spacing:-.02em}
.stat span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}

/* ---------------- demo grid ---------------- */
.intro{margin:44px 0 6px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.intro h2{font-size:22px;font-weight:700;letter-spacing:-.025em}
.intro p{color:var(--muted);font-size:13px;margin-top:5px;max-width:70ch}
.group{margin-top:30px;content-visibility:auto;contain-intrinsic-size:auto 620px}
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
  background-size:cover;transition:transform .5s cubic-bezier(.2,.7,.3,1)}
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

/* ---------------- about ---------------- */
.about{margin-top:60px;background:linear-gradient(180deg,var(--surface),rgba(15,22,38,.6));
  border:1px solid var(--line);border-radius:26px;padding:30px;display:grid;
  grid-template-columns:190px minmax(0,1fr);gap:30px;align-items:start}
.about img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px;display:block;
  box-shadow:0 0 0 1px rgba(255,255,255,.1),0 20px 44px -24px rgba(0,0,0,.9)}
.about h2{font-size:22px;font-weight:700;letter-spacing:-.025em}
.about p{color:var(--ink-2);font-size:14px;margin-top:12px;max-width:66ch}
.about ul{margin:16px 0 0;padding:0;list-style:none;display:grid;gap:9px}
.about li{font-size:13px;color:var(--ink-2);display:flex;gap:9px;align-items:flex-start}
.about li::before{content:"";flex:0 0 6px;width:6px;height:6px;margin-top:7px;border-radius:50%;
  background:linear-gradient(140deg,#a78bfa,#38bdf8)}
.about .cta{margin-top:20px}

.howto{margin-top:34px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:26px}
.howto h2{font-size:18px;font-weight:700;letter-spacing:-.02em}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:16px}
.cols h3{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--brand-2);margin-bottom:6px}
.cols p{font-size:13px;color:var(--ink-2)}
footer{margin-top:34px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;
  font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:18px}
code{background:rgba(148,163,184,.14);padding:1px 5px;border-radius:5px;font-size:.92em}

@media(max-width:900px){
  .hero{grid-template-columns:1fr;gap:26px}
  .portrait{max-width:280px}
  .about{grid-template-columns:1fr;padding:22px}
  .about img{max-width:190px}
}
@media(max-width:600px){
  .wrap{padding:20px 14px 50px}
  .grid{grid-template-columns:1fr}
  .hero .lede{font-size:14.5px}
  .top nav{display:none}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="wrap">

  <!-- ===================== who / nav ===================== -->
  <div class="top">
    <div class="who">
      <img src="${base}${PROFILE.photo}" srcset="${base}${PROFILE.photo2x} 2x" width="44" height="44"
           alt="${esc(PROFILE.name)}" fetchpriority="high" decoding="async">
      <div>
        <b>${esc(PROFILE.name)}</b>
        <span>${esc(PROFILE.role)}</span>
      </div>
    </div>
    <nav>
      <a href="#demos">30 demos</a>
      <a href="#about">About</a>
      <a href="#how">How it works</a>
      <a href="mailto:${esc(PROFILE.email)}">Contact</a>
    </nav>
  </div>

  <!-- ===================== hero ===================== -->
  <div class="hero">
    <div>
      <span class="eyebrow">Portfolio &middot; 2026 &middot; Karachi</span>
      <h1>Thirty dashboards.<br><em>One spreadsheet</em> each.</h1>
      <p class="lede">
        This is the working portfolio of <b>${esc(PROFILE.name)}</b> — I build business dashboards on
        Google Sheets and Apps Script, so a business keeps the spreadsheet it already uses and gets a
        proper screen on top of it. Every demo below is <b>live and clickable</b>: each trade has its own
        layout, its own measuring units and the six numbers that actually decide its week.
      </p>
      <div class="cta">
        <a class="btn primary" href="#demos">Browse the 30 demos</a>
        <a class="btn" href="mailto:${esc(PROFILE.email)}">Start a project &rarr;</a>
      </div>
      <div class="stats" style="margin-top:26px">
        <div class="stat"><b>30</b><span>Trades covered</span></div>
        <div class="stat"><b>${fmtNum(totalRows)}</b><span>Sample rows</span></div>
        <div class="stat"><b>${layoutsUsed.size}</b><span>Distinct layouts</span></div>
        <div class="stat"><b>0</b><span>Licences needed</span></div>
      </div>
    </div>

    <div class="portrait">
      <img src="${base}${PROFILE.photo}" srcset="${base}${PROFILE.photo2x} 2x" width="320" height="320"
           alt="${esc(PROFILE.name)}, dashboard developer in ${esc(PROFILE.location)}" fetchpriority="high" decoding="async">
      <b>${esc(PROFILE.name)}</b>
      <span class="role">${esc(PROFILE.role)}</span>
      <span class="loc">${esc(PROFILE.location)}</span>
      <span>${avail}</span>
    </div>
  </div>

  <!-- ===================== demos ===================== -->
  <div class="intro" id="demos">
    <div>
      <h2>Thirty industries, thirty different dashboards</h2>
      <p>Click any card — it opens the live demo in a new tab, with an industry switcher so you can
        jump between all 30. Every number comes from a generated spreadsheet of 18 months of trading.</p>
    </div>
  </div>
${sectionsFor(base)}

  <!-- ===================== about ===================== -->
  <section class="about" id="about">
    <img src="${base}${PROFILE.photo}" srcset="${base}${PROFILE.photo2x} 2x" width="380" height="380"
         alt="${esc(PROFILE.name)}" loading="lazy" decoding="async">
    <div>
      <h2>About me</h2>
      <p>
        I'm ${esc(PROFILE.name)}, a dashboard developer in ${esc(PROFILE.location)}. Most small and
        mid-sized businesses in Pakistan already run on a spreadsheet — the register, the order book,
        the shift log — and most of the reporting pain comes from nobody turning that sheet into a
        screen the owner can read in ten seconds.
      </p>
      <p>
        So I build exactly that: one Google Sheet as the database, one Apps Script backend, one HTML
        page. No Looker Studio licence, no connector fees, no per-seat pricing, and the owner can edit
        the logic in plain JavaScript afterwards. The 30 demos here are the proof — same codebase,
        completely different screens because a poultry farm and a law firm do not measure the same
        things.
      </p>
      <ul>
        <li><b>Discovery first.</b> We pick the six numbers your week actually turns on, before any chart is drawn.</li>
        <li><b>Your sheet stays yours.</b> Loose heading matching means "Invoice No", "Ref" and "Reference" all work.</li>
        <li><b>Delivered in about a week.</b> Seeded demo first so you approve the screen, then pointed at your live tab.</li>
      </ul>
      <div class="cta">${contactLinks()}</div>
    </div>
  </section>

  <!-- ===================== how it works ===================== -->
  <div class="howto" id="how">
    <h2>How a project runs</h2>
    <div class="cols">
      <div>
        <h3>1 &middot; You pick a demo</h3>
        <p>Choose the closest trade from the 30 above. We swap the sample data for yours and adjust the
          six metrics until the first screen answers the question you ask every morning.</p>
      </div>
      <div>
        <h3>2 &middot; I install it</h3>
        <p><code>Code.gs</code>, <code>SeedData.gs</code> and <code>Index.html</code> go into your own
          Google Sheet's Apps Script editor, deployed as a web app. It runs on your account, not mine.</p>
      </div>
      <div>
        <h3>3 &middot; It updates itself</h3>
        <p>New rows appear on refresh — no rebuild, no export. You own the file, the sheet and the code,
          and I stay reachable for changes.</p>
      </div>
    </div>
  </div>

  <footer>
    <span>&copy; 2026 ${esc(PROFILE.name)} &middot; Karachi &middot; built with Google Sheets + Apps Script</span>
    <span>All demo data is generated sample data, not real client records.</span>
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

# pages change whenever you rebuild — never serve a stale copy
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# thumbnails and the portrait are content-stable; cache them hard (this is what makes it feel instant)
/thumbs/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/screenshots/*
  Cache-Control: public, max-age=31536000, immutable
`);

/* Portfolio folder still exists in the repo (for offline browsing) — point crawlers at the root. */
fs.writeFileSync(path.join(ROOT, '_redirects'), `# Cloudflare Pages redirects — https://developers.cloudflare.com/pages/configuration/redirects/
# The deployed site is /index.html; the duplicate under /portfolio is for browsing off disk.
/portfolio             /   301
/portfolio/index.html  /   301
`);

fs.writeFileSync(path.join(ROOT, '404.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found &mdash; ${esc(PROFILE.name)}'s dashboard portfolio</title>
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
  <p>The industry switcher inside every dashboard lists all ${payloads.length}, or start from the portfolio.</p>
  <a href="/">Back to all ${payloads.length} dashboards</a>
</div></body></html>
`);

const thumbBytes = Object.keys(thumbs).length;
console.log(`index.html (repo root)      : ${payloads.length} cards, ${GROUPS.length} groups, ${fmtNum(totalRows)} rows`);
console.log(`portfolio/index.html        : same page with ../ paths for offline browsing`);
const thumbKB = Object.values(thumbs).length
  ? Math.round(fs.statSync(path.join(ROOT, 'thumbs', path.basename(Object.values(thumbs)[0].file))).size / 1024)
  : 0;
console.log(`thumbs in use               : ${thumbBytes} WebP files (~${thumbKB} KB each, was ~750 KB of PNG)`);
console.log(`profile                     : ${PROFILE.name} · ${PROFILE.email}${PROFILE.whatsapp ? ' · WhatsApp' : ''}`);
console.log(`_headers, _redirects, 404   : Cloudflare Pages ready`);
