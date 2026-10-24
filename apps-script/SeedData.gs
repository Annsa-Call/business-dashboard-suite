/**************************************************************************************************
 *  BUSINESS DASHBOARD SUITE  ·  SeedData.gs        (DEMO / SAMPLE DATA BUILDER)
 *  ------------------------------------------------------------------------------------------------
 *  Creates believable, large-scale demo data for all fifteen industries in Code.gs — then backs off
 *  and lets you type over it.
 *
 *  WHY THIS DATA LOOKS REAL
 *    · Amounts are in the millions (PKR) and sized per industry: a Karachi real-estate agency books
 *      commission in crores, a café does a few hundred thousand a day.
 *    · Dates are relative to TODAY, spread over 18 months, and land on real Pakistani calendar
 *      events: Ramadan/Eid demand spikes and dips, wedding season, school admission season,
 *      monsoon construction slowdown, 14 August, year-end corporate push.
 *    · Volumes follow the calendar, not a flat average: daily covers, order counts and shipment
 *      counts rise and fall by weekday and season, so the trend lines have shape instead of noise.
 *    · Money follows a power law: a few clients carry most of the revenue (Pareto), the rest tail off.
 *    · Statuses are aged realistically: old invoices are almost all paid, recent ones are still open,
 *      and a small, believable slice is genuinely overdue.
 *
 *  HOW TO RUN
 *      📊 Dashboard → "Seed demo data…"      (asks: all, or one industry)
 *      …or run  seedDemoData()  from the editor.
 *      …or run  seedDemoData(['clinic','gym'])  for just those two.
 *
 *  Edit SEED_CONFIG below: row counts, SCALE multiplier, history length, seed, colours, formats.
 *
 *  NOTE: this file imports tab names and headings from Code.gs (demoIndustries()), so the sheets it
 *  writes can never drift out of sync with what the dashboard reads.
 **************************************************************************************************/


/* ================================================================================================
 *  1. CONFIG
 * ============================================================================================== */
const SEED_CONFIG = {
  INDUSTRIES: 'all',           // 'all'  or  ['agency','clinic',…]   (the menu prompts too)
  MONTHS: 18,                  // history depth
  SCALE: 1,                    // 1 = defaults · 2 = double the rows · 0.5 = half
  SEED: 20261021,              // change for a different (but still repeatable) dataset
  CLEAR_FIRST: true,           // clear the target tabs before writing
  CONFIRM: true,               // ask before overwriting data
  DROP_DEFAULT_SHEET: true,    // delete an empty "Sheet1"
  FORMAT: true,                // header styling, banding, number formats, dropdowns

  CURRENCY_FORMAT: '"Rs" #,##0',
  DATE_FORMAT: 'dd mmm yyyy',
  HEADER_BG: '#4f46e5',
  HEADER_FG: '#ffffff',
  BANDING: 'LIGHT_GREY',
};

/** Base row counts per industry (before SCALE). Keys are tab keys from Code.gs. */
const SEED_ROWS = {
  agency:       { leads: 600,  clients: 110, invoices: 540 },
  realestate:   { listings: 180, enquiries: 620, deals: 95 },
  coaching:     { enrollments: 420, sessions: 2400, payments: 620 },
  ecommerce:    { orders: 2200, products: 180, customers: 850 },
  restaurant:   { sales: 545, menu: 80, expenses: 320 },
  salon:        { appointments: 4200, clients: 520, services: 40 },
  gym:          { members: 480, attendance: 5000, payments: 1400 },
  school:       { students: 480, attendance: 3600, fees: 2600 },
  clinic:       { appointments: 3000, patients: 620, treatments: 36 },
  travel:       { bookings: 420, packages: 48, payments: 800 },
  construction: { projects: 42, expenses: 900, invoices: 320 },
  photography:  { events: 210, bookings: 260, expenses: 420 },
  saas:         { subscriptions: 320, invoices: 1600, tickets: 900 },
  logistics:    { shipments: 1800, clients: 70, invoices: 600 },
  lawfirm:      { matters: 150, time: 3200, invoices: 520 },

  /* ---- v2 · industries 16–30 ---- */
  hotel:        { stays: 5200, rooms: 44, expenses: 260 },
  factory:      { production: 1650, downtime: 420, orders: 160 },
  recruitment:  { roles: 230, candidates: 1400, invoices: 270 },
  pharmacy:     { sales: 545, inventory: 320, purchases: 230 },
  poultry:      { flocks: 14, daily: 151, sales: 620 },
  fuelstation:  { shifts: 1650, shop: 900, credit: 60 },
  msp:          { tickets: 14000, contracts: 26, invoices: 330 },
  autoshop:     { jobs: 9800, parts: 240, expenses: 260 },
  printing:     { jobs: 640, machines: 6, expenses: 180 },
  textile:      { lines: 1200, orders: 130, defects: 420 },
  bakery:       { production: 2160, orders: 180, sales: 180 },
  courier:      { shipments: 12000, remittance: 320, complaints: 240 },
  archfirm:     { projects: 46, timesheets: 3000, invoices: 132 },
  vetclinic:    { visits: 7200, vaccinations: 1600, inventory: 180 },
  solar:        { projects: 260, payments: 900, inventory: 90 },
};


/* ================================================================================================
 *  2. RANDOM + DATE UTILITIES  (deterministic: same seed → same dataset)
 * ============================================================================================== */
var __seedState = SEED_CONFIG.SEED >>> 0;

function rnd_() {
  __seedState = (__seedState + 0x6D2B79F5) >>> 0;
  var t = __seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint_(min, max) { return Math.floor(rnd_() * (max - min + 1)) + min; }
function pick_(list) { return list[Math.floor(rnd_() * list.length)]; }
function pickW_(pairs) {                       // [[value, weight], …]
  var total = 0, i;
  for (i = 0; i < pairs.length; i++) total += pairs[i][1];
  var roll = rnd_() * total;
  for (i = 0; i < pairs.length; i++) { roll -= pairs[i][1]; if (roll <= 0) return pairs[i][0]; }
  return pairs[pairs.length - 1][0];
}
/** Power-law pick: index 0 is most likely. Drives "a few clients carry the revenue". */
function pareto_(n) { return Math.min(n - 1, Math.floor(Math.pow(rnd_(), 2.2) * n)); }
function roundTo_(v, step) { return Math.round(v / step) * step; }

var TODAY_ = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

function daysAgo_(n, hour) {
  var d = new Date(TODAY_.getTime());
  d.setDate(d.getDate() - n);
  d.setHours(hour === undefined ? rint_(9, 20) : hour, rint_(0, 59), 0, 0);
  return d;
}
function daysFromToday_(n, hour) {
  var d = new Date(TODAY_.getTime());
  d.setDate(d.getDate() + n);
  d.setHours(hour === undefined ? rint_(9, 18) : hour, rint_(0, 59), 0, 0);
  return d;
}
function isWeekend_(d) { var g = d.getDay(); return g === 0 || g === 6; }
function monthKey_(d) { return d.getFullYear() + '-' + (d.getMonth() + 1); }


/* ================================================================================================
 *  3. SEASONALITY  —  real Pakistani calendar shape per business type
 *  Multipliers are deliberately obvious in the data so trends have a story to tell.
 * ============================================================================================== */
const PK_EVENTS = [
  // [label, start 'YYYY-MM-DD', end 'YYYY-MM-DD', approx?]
  ['Eid-ul-Adha 2025', '2025-06-06', '2025-06-09'],
  ['Muharram 2025', '2025-07-05', '2025-07-06'],
  ['Independence Day 2025', '2025-08-13', '2025-08-14'],
  ['Wedding season 25/26', '2025-11-01', '2026-02-15'],
  ['Ramadan 2026', '2026-02-18', '2026-03-19'],
  ['Eid-ul-Fitr 2026', '2026-03-20', '2026-03-23'],
  ['Eid-ul-Adha 2026', '2026-05-26', '2026-05-29'],
  ['Monsoon 2026', '2026-07-01', '2026-08-20'],
  ['Independence Day 2026', '2026-08-13', '2026-08-14'],
  ['Wedding season 26/27', '2026-10-01', '2026-12-31'],
];

function inEvent_(date, label) {
  for (var i = 0; i < PK_EVENTS.length; i++) {
    if (PK_EVENTS[i][0] !== label) continue;
    var start = new Date(PK_EVENTS[i][1] + 'T00:00:00');
    var end = new Date(PK_EVENTS[i][2] + 'T23:59:59');
    return date >= start && date <= end;
  }
  return false;
}

/**
 * Seasonal multiplier for a date.
 * @param {Date} d
 * @param {string} kind  retail | b2b | food | salon | gym | school | travel | build | photo | saas | freight | legal | clinic | coaching
 */
function season_(d, kind) {
  var m = d.getMonth();                       // 0 = Jan
  var f = 1;

  // ---- shared Pakistani calendar ----
  if (inEvent_(d, 'Ramadan 2026')) {
    if (kind === 'food') f *= 1.45;           // iftar and delivery surge
    else if (kind === 'retail' || kind === 'salon') f *= 1.30;
    else if (kind === 'b2b' || kind === 'legal' || kind === 'saas') f *= 0.78;
    else if (kind === 'gym') f *= 0.72;
    else if (kind === 'school') f *= 0.9;
  }
  if (inEvent_(d, 'Eid-ul-Fitr 2026') || inEvent_(d, 'Eid-ul-Adha 2026') || inEvent_(d, 'Eid-ul-Adha 2025')) {
    if (kind === 'food' || kind === 'retail' || kind === 'salon' || kind === 'travel') f *= 1.55;
    else if (kind === 'b2b' || kind === 'freight' || kind === 'build') f *= 0.55;
    else if (kind === 'clinic') f *= 0.7;
  }
  if (inEvent_(d, 'Wedding season 25/26') || inEvent_(d, 'Wedding season 26/27')) {
    if (kind === 'photo' || kind === 'salon' || kind === 'retail') f *= 1.5;
    if (kind === 'travel') f *= 1.2;
  }
  if (inEvent_(d, 'Independence Day 2025') || inEvent_(d, 'Independence Day 2026')) {
    if (kind === 'retail' || kind === 'food') f *= 1.35;
  }
  if (inEvent_(d, 'Monsoon 2026')) {
    if (kind === 'build' || kind === 'freight') f *= 0.7;
    if (kind === 'clinic') f *= 1.1;          // seasonal illness
  }

  // ---- month-of-year shape ----
  if (kind === 'gym')         { if (m === 0) f *= 1.6; if (m >= 5 && m <= 7) f *= 0.8; }
  if (kind === 'school')      { if (m >= 3 && m <= 7) f *= 1.35; if (m === 11) f *= 0.8; }
  if (kind === 'retail')      { if (m === 10 || m === 11) f *= 1.3; }
  if (kind === 'b2b' || kind === 'saas') { if (m === 11) f *= 1.2; if (m === 0) f *= 0.9; }
  if (kind === 'photo')       { if (m >= 9 && m <= 11) f *= 1.4; if (m >= 5 && m <= 6) f *= 0.6; }
  if (kind === 'travel')      { if (m >= 4 && m <= 6) f *= 1.3; if (m === 11) f *= 1.15; }
  if (kind === 'build')       { if (m === 11) f *= 0.85; }
  if (kind === 'restaurant')  { if (m >= 4 && m <= 6) f *= 1.1; }

  // ---- growth trend: the business is (mostly) growing over the window ----
  var monthsBack = (TODAY_.getFullYear() - d.getFullYear()) * 12 + (TODAY_.getMonth() - d.getMonth());
  f *= Math.pow(1.018, Math.max(-18, -monthsBack));   // ~1.8% compounding per month

  return f;
}

/** Count for one day, shaped by season + weekday, with a little noise. */
function dailyCount_(d, kind, avgPerDay, weekendBoost) {
  var f = season_(d, kind) * (1 + (isWeekend_(d) ? (weekendBoost || 0) : 0));
  var v = avgPerDay * f * (0.82 + rnd_() * 0.36);
  return Math.max(0, Math.round(v));
}

/**
 * Builds a weighted list of dates across the window — this is what makes
 * a histogram of the data look like a real business calendar.
 */
function seasonWeightedDates_(kind, count, weekdayOnly) {
  var out = [];
  var totalDays = SEED_CONFIG.MONTHS * 30;
  var pool = [];
  var weights = [];
  var totalWeight = 0;

  for (var i = 0; i <= totalDays; i++) {
    var d = new Date(TODAY_.getTime());
    d.setDate(d.getDate() - i);
    if (weekdayOnly && isWeekend_(d)) continue;
    var w = season_(d, kind);
    pool.push(d);
    weights.push(w);
    totalWeight += w;
  }

  for (var n = 0; n < count; n++) {
    var roll = rnd_() * totalWeight;
    var idx = 0;
    while (idx < weights.length - 1 && roll > weights[idx]) { roll -= weights[idx]; idx++; }
    var base = pool[idx];
    var copy = new Date(base.getTime());
    copy.setHours(rint_(9, 20), rint_(0, 59), 0, 0);
    out.push(copy);
  }
  return out.sort(function (a, b) { return a - b; });
}


/* ================================================================================================
 *  4. SHARED VOCABULARY  (Pakistani names, Karachi neighbourhoods, vendors)
 * ============================================================================================== */
var FIRST = ['Ayesha','Daniyal','Mehwish','Hamza','Farah','Usman','Sana','Ali','Zara','Bilal','Hina','Omar',
  'Rabia','Faisal','Nida','Tariq','Amna','Kashif','Areeba','Junaid','Mariam','Shahid','Iqra','Waleed','Sadia',
  'Ahsan','Laiba','Rizwan','Noor','Adnan','Sumbul','Yasir','Hira','Talha','Mahnoor','Zain','Anum','Sohail',
  'Komal','Basit','Faiza','Imran','Nimra','Shayan','Aqsa','Rehan','Bushra','Arsalan','Tehmina','Danish'];
var LAST = ['Khan','Raza','Ali','Sheikh','Siddiqui','Tariq','Ahmed','Malik','Hussain','Iqbal','Farooqi',
  'Qureshi','Butt','Chaudhry','Abbasi','Baig','Jamal','Nawaz','Rehman','Zafar','Shaikh','Memon','Soomro','Lodhi'];
var COMPANIES = ['Northline Foods','Vertex Studio','Orbit Logistics','Pinewood Realty','Bloom Interiors',
  'Cedar Motors','Seaspray Textiles','Karachi Cargo Co','Mint Health','Skyline Builders','Zenith Appliances',
  'Falcon Traders','GreenLeaf Organics','Pixel Forge','Blue Harbour','Crescent Pharma','Urban Threads',
  'Delta Foods','Silverline Auto','Nova Interiors','Aurora Tech','Bright Steels','Cobalt Media','Denim House',
  'Everest Sports','Fortune Fabrics','Gulberg Cafe','Harbor Freight Co','Indigo Travels','Juniper Cosmetics',
  'Kestrel Software','Lumen Electricals','Maple Furnishings','Nexus Traders','Opal Jewellers','Prism Packaging',
  'Quetta Dry Fruits','Rapid Couriers','Summit Realty','Terra Agro','Umber Studio','Vista Optics',
  'White Sand Resorts','Xenon Labs','Yellow Brick Cafe','Zephyr Textiles','Amber Motors','Basil Restaurants'];
var KARACHI_AREAS = ['DHA Phase 6','DHA Phase 8','Clifton Block 5','Bahria Town Karachi','Gulshan-e-Iqbal',
  'PECHS Block 6','Scheme 33','Malir Cantt','Korangi','North Nazimabad','Federal B Area','DHA City',
  'Askari IV','Gulistan-e-Johar','Saddar','Bath Island'];
var CITIES = ['Karachi','Lahore','Islamabad','Faisalabad','Rawalpindi','Multan','Peshawar','Hyderabad','Sialkot'];
var OWNERS = ['Bilal Ahmed','Hira Khan','Sana Malik','Usman Tariq','Areeba Sheikh','Danish Ali','Komal Farooqi'];

function pName_() { return pick_(FIRST) + ' ' + pick_(LAST); }
function pCompany_() { return pick_(COMPANIES); }
function pPhone_() { return '+92 ' + pick_(['300','301','302','310','311','312','321','322','331','333','334','345','346']) + ' ' + rint_(1000000, 9999999); }
function pEmail_(name, company) {
  var slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'info'; };
  return slug(String(name).split(' ')[0]) + '@' + slug(company) + '.pk';
}


/* ================================================================================================
 *  5. GENERATORS  —  one per industry. Each returns { tabKey: [ [cells…], … ] }
 *     Cell order must match the column order declared in Code.gs. The writer handles headers.
 * ============================================================================================== */

/* ---------------------------------------------------------------- 01 · AGENCY --------------- */
function genAgency_(rows) {
  var out = { leads: [], clients: [], invoices: [] };
  var sources = ['Website','Referral','LinkedIn','Instagram','Google Ads','Cold Outreach','Partner'];
  var stages = [['New',14],['Contacted',12],['Qualified',9],['Proposal',9],['Won',30],['Lost',26]];
  var services = ['SEO Retainer','Social Media','Performance Ads','Web Development','Brand + Content','Email & CRM'];
  var methods = ['Bank Transfer','Cheque','Card','Wise'];

  // ---- clients first (their retainers drive the invoice amounts) ----
  var clientNames = [];
  for (var c = 0; c < rows.clients; c++) {
    var active = pickW_([['Active', 82], ['On Hold', 11], ['Churned', 7]]);
    var mrr = roundTo_(30000 + Math.pow(rnd_(), 1.9) * 420000, 5000);   // 30k–450k, skewed low
    var start = daysAgo_(active === 'Active' ? rint_(20, 900) : rint_(120, 900));
    var name = c < 60 ? COMPANIES[c % COMPANIES.length] : pCompany_() + ' ' + pick_(['Karachi','Lahore','Trading','Group']);
    clientNames.push(name);
    out.clients.push([name, pick_(services), mrr, active, start, pick_(OWNERS)]);
  }

  // ---- leads ----
  var leadDates = seasonWeightedDates_('b2b', rows.leads, false);
  var upcoming = 0;
  for (var l = 0; l < leadDates.length; l++) {
    var status = pickW_(stages);
    var open = status !== 'Won' && status !== 'Lost';
    var followUp = '';
    if (open) {
      if (upcoming < 16) {                        // guarantee a populated follow-up card
        followUp = daysFromToday_(upcoming === 0 ? 0 : 1 + (upcoming % 6), 10);
        upcoming++;
      } else if (rnd_() < 0.6) {
        followUp = rnd_() < 0.75 ? daysFromToday_(rint_(7, 40), 10) : daysAgo_(rint_(1, 20), 10);
      }
    }
    out.leads.push([
      leadDates[l],
      pName_(),
      pCompany_() + (rnd_() < 0.25 ? ' ' + pick_(['Karachi','Lahore','Islamabad']) : ''),
      pick_(sources),
      status,
      pick_(OWNERS),
      roundTo_(120000 + Math.pow(rnd_(), 1.6) * 900000, 5000),
      followUp,
    ]);
  }

  // ---- invoices: monthly retainers + project fees ----
  for (var i = 0; i < rows.invoices; i++) {
    var d = seasonWeightedDates_('b2b', 1, false)[0];
    var clientIdx = pareto_(clientNames.length);
    var base = out.clients[clientIdx][2];
    var amount = roundTo_(base * (0.9 + rnd_() * 1.4), 1000);
    if (rnd_() < 0.18) amount = roundTo_(amount * (1.5 + rnd_() * 2), 1000);   // project spike
    var due = new Date(d.getTime()); due.setDate(due.getDate() + 14);
    var age = Math.round((TODAY_ - due) / 86400000);
    var status, paid = '';
    if (age < -2) { status = 'Pending'; }
    else if (age <= 45) { status = pickW_([['Paid', 64], ['Pending', 20], ['Overdue', 16]]); }
    else { status = pickW_([['Paid', 96], ['Overdue', 4]]); }
    if (status === 'Paid') {
      var p = new Date(due.getTime()); p.setDate(p.getDate() + rint_(-3, 9));
      if (p > TODAY_) p = daysAgo_(rint_(0, 4));
      paid = p;
    } else if (i % 17 === 0) {                   // a predictable band of genuinely overdue invoices
      status = 'Overdue';
      due = daysAgo_(rint_(5, 60));
    }
    out.invoices.push(['INV-' + (2400 + i), clientNames[clientIdx], amount, due, paid, status, pick_(methods)]);
  }
  return out;
}

/* ---------------------------------------------------------------- 02 · REAL ESTATE ---------- */
function genRealEstate_(rows) {
  var out = { listings: [], enquiries: [], deals: [] };
  var types = ['Flat','House','Plot','Shop','Office','Penthouse','Warehouse'];
  var sources = ['Zameen','OLX','Instagram','Walk-in','Referral','Facebook','Property Portal'];
  var agents = ['Fahad Siddiqui','Nadia Rehman','Asad Baig','Kiran Memon','Zohaib Qureshi'];
  var stages = ['Enquiry','Viewing','Negotiation','Token','Closed'];
  var priceFor = { Flat: [12000000, 45000000], House: [35000000, 180000000],
                   Plot: [8000000, 90000000], Shop: [15000000, 70000000],
                   Office: [20000000, 120000000], Penthouse: [60000000, 250000000],
                   Warehouse: [25000000, 100000000] };

  var listingNames = [];
  for (var i = 0; i < rows.listings; i++) {
    var type = pick_(types);
    var band = priceFor[type];
    var price = roundTo_(band[0] + Math.pow(rnd_(), 2.1) * (band[1] - band[0]), 100000);
    var area = pick_(KARACHI_AREAS);
    var title = type + ' in ' + area;
    listingNames.push(title);
    var status = pickW_([['Active', 62], ['Under Offer', 12], ['Sold', 18], ['Withdrawn', 8]]);
    out.listings.push([
      'L-' + (1400 + i), title, area, type, price, status,
      daysAgo_(rint_(1, 400)), pick_(agents),
    ]);
  }

  var enqDates = seasonWeightedDates_('b2b', rows.enquiries, false);
  for (var e = 0; e < enqDates.length; e++) {
    var lidx = pareto_(listingNames.length);
    out.enquiries.push([
      enqDates[e], listingNames[lidx], pName_(), pick_(sources),
      roundTo_(toNumberSafe_(out.listings[lidx][4]) * (0.7 + rnd_() * 0.5), 100000),
      pickW_([['New', 34], ['Contacted', 26], ['Viewing', 20], ['Negotiation', 12], ['Closed', 6], ['Dropped', 2]]),
    ]);
  }

  for (var d2 = 0; d2 < rows.deals; d2++) {
    var li = pareto_(listingNames.length);
    var sale = roundTo_(toNumberSafe_(out.listings[li][4]) * (0.88 + rnd_() * 0.18), 100000);
    var comm = roundTo_(sale * (0.015 + rnd_() * 0.01), 1000);      // 1.5–2.5%
    var stage = pickW_([['Closed', 55], ['Token', 15], ['Negotiation', 18], ['Viewing', 12]]);
    var closedDate = '';
    if (stage === 'Closed') {
      var cd = daysAgo_(rint_(3, 520));
      if (d2 % 11 === 0) cd = daysAgo_(rint_(2, 27));               // a few fresh closings
      closedDate = cd;
    }
    out.deals.push([
      'D-' + (700 + d2), listingNames[li], pName_(), sale, comm, closedDate, stage,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 03 · COACHING ------------ */
function genCoaching_(rows) {
  var out = { enrollments: [], sessions: [], payments: [] };
  var programs = [
    ['Digital Marketing Pro', 85000], ['Freelancing Bootcamp', 45000],
    ['IELTS Intensive', 32000], ['Career Switch Program', 120000],
    ['Public Speaking Mastery', 28000], ['E-commerce Launchpad', 95000],
  ];
  var modes = ['Online','On-site','Recorded'];

  var students = [];
  var enrDates = seasonWeightedDates_('coaching', rows.enrollments, false);
  for (var i = 0; i < enrDates.length; i++) {
    var prog = pick_(programs);
    var name = pName_();
    students.push({ name: name, program: prog[0], fee: prog[1] });
    var status = pickW_([['Active', 58], ['Completed', 30], ['Dropped', 8], ['Refunded', 4]]);
    out.enrollments.push([
      enrDates[i], name, prog[0],
      roundTo_(prog[1] * (0.9 + rnd_() * 0.3), 1000),
      status,
      'Cohort ' + (1 + Math.floor(rnd_() * 8)) + ' · ' + enrDates[i].getFullYear(),
    ]);
  }

  var sesDates = seasonWeightedDates_('coaching', rows.sessions, false);
  for (var s = 0; s < sesDates.length; s++) {
    var st = pick_(students);
    out.sessions.push([
      sesDates[s], st.name, st.program,
      rnd_() < 0.82 ? 'Yes' : 'No',
      pickW_([['Online', 62], ['On-site', 30], ['Recorded', 8]]),
    ]);
  }

  for (var p = 0; p < rows.payments; p++) {
    var st2 = pick_(students);
    var due = seasonWeightedDates_('coaching', 1, false)[0];
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age < 0) status2 = 'Pending';
    else if (age <= 40) status2 = pickW_([['Paid', 70], ['Pending', 20], ['Overdue', 10]]);
    else status2 = pickW_([['Paid', 94], ['Overdue', 6]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 10)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 3)); paid = pd; }
    out.payments.push([
      st2.name, st2.program, roundTo_(st2.fee * pick_([1, 0.5, 0.5, 0.25]), 500),   // instalments
      due, paid, status2,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 04 · E-COMMERCE ---------- */
function genEcommerce_(rows) {
  var out = { orders: [], products: [], customers: [] };
  var categories = ['Lawn & Pret','Formals','Accessories','Footwear','Home & Living','Beauty'];
  var channels = [['Website', 34], ['Instagram', 26], ['WhatsApp', 18], ['Daraz', 14], ['Facebook', 8]];
  var cities = CITIES;

  // ---- customers (power-law order counts) ----
  var cust = [];
  for (var c = 0; c < rows.customers; c++) {
    var name = pName_();
    var first = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30));
    // ~28% of customers buy again (benchmark 25–30%), a few of them heavily.
    var n = rnd_() < 0.28 ? 2 + pareto_(7) : 1;
    var ltv = roundTo_(n * (4500 + Math.pow(rnd_(), 1.4) * 28000), 100);
    cust.push({ name: name, orders: n, ltv: ltv });
    out.customers.push([
      'C-' + (9000 + c), name, pick_(cities), first, n, ltv,
      n > 4 ? 'VIP' : n > 1 ? 'Repeat' : 'New',
    ]);
  }

  // ---- products ----
  var prodNames = ['Embroidered Lawn 3-Piece','Chiffon Formal Suit','Cotton Kurta','Silk Dupatta',
    'Linen Co-ord Set','Velvet Shawl','Kundan Earrings','Leather Khussa','Block Heels','Lawn 2-Piece',
    'Bridal Clutch','Bath Towel Set','Scented Candle','Face Serum','Bridal Lehenga'];
  for (var p = 0; p < rows.products; p++) {
    var cat = pick_(categories);
    var price = roundTo_(1800 + Math.pow(rnd_(), 1.5) * 42000, 100);
    out.products.push([
      'SKU-' + (1000 + p),
      prodNames[p % prodNames.length] + (p >= prodNames.length ? ' ' + pick_(['Premium','Classic','New','Limited']) : ''),
      cat, price, roundTo_(price * (0.45 + rnd_() * 0.15), 50),
      rint_(0, 120), rint_(5, 400),
    ]);
  }

  // ---- orders: daily volume shaped by season/weekend ----
  var orderDates = [];
  for (var dayBack = SEED_CONFIG.MONTHS * 30; dayBack >= 0; dayBack--) {
    var d = daysAgo_(dayBack, 12);
    var n = dailyCount_(d, 'retail', 4.2, 0.18);            // ~4 orders/day average, weekends busier
    for (var k = 0; k < n; k++) orderDates.push(new Date(d.getTime()));
  }
  orderDates = orderDates.slice(-rows.orders);   // keep the newest window, not the oldest

  for (var o = 0; o < orderDates.length; o++) {
    var customer = cust[pareto_(cust.length)];
    var prod = out.products[rint_(0, out.products.length - 1)];
    var items = pickW_([[1, 62], [2, 24], [3, 9], [4, 5]]);
    var revenue = roundTo_(toNumberSafe_(prod[3]) * items * (0.85 + rnd_() * 0.3), 50);
    var cost = roundTo_(revenue * (0.52 + rnd_() * 0.13), 50);
    var status = pickW_([['Delivered', 82], ['Shipped', 9], ['Processing', 5], ['Returned', 3], ['Cancelled', 1]]);
    out.orders.push([
      'ORD-' + (50000 + o), orderDates[o], customer.name, pick_(channels.map(function (x) { return x[0]; })),
      prod[2], items, revenue, cost, status,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 05 · RESTAURANT ----------- */
function genRestaurant_(rows) {
  var out = { sales: [], menu: [], expenses: [] };
  var menuCats = ['Starters','Main Course','BBQ & Grill','Rice & Biryani','Desserts','Beverages','Bakery'];
  var vendors = ['Al-Madina Supplies','Karachi Fresh Produce','Metro Cash & Carry','Sea Breeze Seafood',
    'Sunrise Dairy','Imtiaz Wholesale','Local Vegetable Market'];

  var items = ['Chicken Karahi','Beef Biryani','Seekh Kebab','Malai Boti','Mutton Nihari','Chicken Handi',
    'Zinger Burger','Fettuccine Alfredo','Club Sandwich','Loaded Fries','Mutton Pulao','Daal Makhani',
    'Chicken Tikka','Fish & Chips','Chocolate Lava Cake','Cheesecake','Gulab Jamun','Kheer',
    'Kashmiri Chai','Cold Brew','Fresh Lime','Mango Shake','Cappuccino','Garlic Naan','Butter Naan'];
  for (var m = 0; m < rows.menu; m++) {
    var cat = pick_(menuCats);
    var price = roundTo_(350 + Math.pow(rnd_(), 1.4) * 2600, 50);
    out.menu.push([
      items[m % items.length] + (m >= items.length ? ' ' + pick_(['Special','Platter','Large','House']) : ''),
      cat, price, roundTo_(price * (0.26 + rnd_() * 0.12), 10), rint_(40, 900),
    ]);
  }

  // one row per trading day: covers × average check, with season + weekend shape
  var dayparts = ['Lunch','Evening','Late Night','Delivery'];
  for (var back = rows.sales; back >= 0; back--) {
    var d = daysAgo_(back, 20);
    var covers = dailyCount_(d, 'food', 155, 0.35);           // busier weekends, Ramadan iftar surge
    var check = 950 + rnd_() * 750;                            // PKR 950–1,700 per cover
    var revenue = roundTo_(covers * check, 100);
    var foodCost = roundTo_(revenue * (0.285 + rnd_() * 0.055), 100);
    var labour = roundTo_(revenue * (0.24 + rnd_() * 0.05), 100);
    var delivery = roundTo_(revenue * (0.18 + rnd_() * 0.22), 100);
    out.sales.push([
      d, covers, revenue, foodCost, labour, delivery, pick_(dayparts),
    ]);
  }

  for (var e = 0; e < rows.expenses; e++) {
    var dd = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12);
    out.expenses.push([
      dd, pick_(['Rent','Utilities','Maintenance','Marketing','Packaging','Licences','Small Equipment']),
      // These are the *extra* overheads — food and labour already sit in the daily-sales tab.
      roundTo_(15000 + Math.pow(rnd_(), 1.6) * 165000, 500), pick_(vendors),
      pick_(['Monthly','Weekly restock','Repair','Campaign','Quarterly']),
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 06 · SALON --------------- */
function genSalon_(rows) {
  var out = { appointments: [], clients: [], services: [] };
  var stylists = ['Ayesha (Senior)','Rabia','Hina','Sana','Mehreen','Zara','Faiza'];
  var services = [
    ['Haircut & Styling','Hair',3500,45], ['Hair Colour','Hair',12000,90],
    ['Keratin Treatment','Hair',28000,150], ['Blow Dry','Hair',2500,30],
    ['Facial – Hydrafacial','Skin',9500,60], ['Facial – Whitening','Skin',14000,75],
    ['Threading (Full Face)','Skin',1800,25], ['Waxing (Full Body)','Skin',7500,60],
    ['Manicure','Nails',3200,45], ['Pedicure','Nails',4500,50],
    ['Gel Extensions','Nails',8500,90], ['Bridal Makeup','Bridal',65000,180],
    ['Party Makeup','Bridal',18000,90], ['Nikkah Look','Bridal',45000,150],
    ['Hair Spa','Hair',6500,60], ['Massage – Deep Tissue','Spa',8500,60],
  ];

  for (var s = 0; s < rows.services; s++) {
    var sv = services[s % services.length];
    out.services.push([
      sv[0] + (s >= services.length ? ' ' + pick_(['Premium','Express']) : ''),
      sv[1], roundTo_(sv[2] * (0.9 + rnd_() * 0.25), 100), sv[3], rint_(15, 420),
    ]);
  }

  var clients = [];
  for (var c = 0; c < rows.clients; c++) {
    var name = pName_();
    var visits = 1 + pareto_(14);
    var ltv = roundTo_(visits * (4200 + Math.pow(rnd_(), 1.3) * 22000), 100);
    clients.push({ name: name, visits: visits });
    out.clients.push([
      name, pPhone_(), daysAgo_(rint_(0, 900)), visits, ltv,
      visits > 10 ? 'Platinum' : visits > 5 ? 'Gold' : visits > 2 ? 'Silver' : 'New',
    ]);
  }

  var apptDates = seasonWeightedDates_('salon', rows.appointments, false);
  for (var a = 0; a < apptDates.length; a++) {
    var cl = clients[pareto_(clients.length)];
    var svc = services[rint_(0, services.length - 1)];
    var status = pickW_([['Completed', 86], ['No Show', 5], ['Cancelled', 4], ['Scheduled', 5]]);
    // future bookings only for "Scheduled"
    var date = apptDates[a];
    if (status === 'Scheduled') date = daysFromToday_(rint_(0, 12), rint_(10, 18));
    out.appointments.push([
      date, cl.name, svc[0], pick_(stylists),
      roundTo_(svc[2] * (0.9 + rnd_() * 0.3), 100), svc[3],
      rnd_() < 0.58 ? 'Yes' : 'No', status,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 07 · GYM ------------------ */
function genGym_(rows) {
  var out = { members: [], attendance: [], payments: [] };
  var plans = [['Basic', 4500], ['Premium', 8500], ['Elite', 14000], ['Student', 3200], ['PT Add-on', 22000]];
  var trainers = ['Coach Ahsan','Coach Sana','Coach Bilal','Coach Nimra','Coach Rehan'];
  var classes = ['Strength','CrossFit','Yoga','Spin','Boxing','HIIT','Zumba','Pilates'];
  var members = [];

  for (var m = 0; m < rows.members; m++) {
    var plan = pickW_([[plans[0], 30], [plans[1], 30], [plans[2], 18], [plans[3], 14], [plans[4], 8]]);
    var name = pName_();
    var join = daysAgo_(rint_(0, 900));
    var status = pickW_([['Active', 88], ['Expired', 7], ['Cancelled', 4], ['Frozen', 1]]);
    var renewal = daysFromToday_(rint_(-10, 60), 12);
    members.push({ name: name, plan: plan[0], fee: plan[1] });
    out.members.push([
      'M-' + (3000 + m), name, plan[0], join, renewal, plan[1],
      rnd_() < 0.45 ? pick_(trainers) : '',
      status,
    ]);
  }

  // Attendance is a *dense* recent log — 45 days is enough for "visits per member per week"
  // and keeps the tab light. Spreading 5,000 check-ins over 18 months would imply ~6 a day.
  var attTarget = rows.attendance;
  var ATT_WINDOW = 45;
  var perDay = Math.max(2, Math.round(attTarget / ATT_WINDOW));
  var att = [];
  for (var back = ATT_WINDOW; back >= 0; back--) {
    var d = daysAgo_(back, 18);
    var n = dailyCount_(d, 'gym', perDay, -0.12);            // weekdays busier than weekends
    if (d.getDay() === 1 || d.getDay() === 2) n = Math.round(n * 1.25);
    for (var k = 0; k < n; k++) {
      var mem = members[pareto_(members.length)];
      att.push([new Date(d.getTime()), mem.name, pick_(classes), 1]);
    }
  }
  out.attendance = att.slice(-attTarget);

  for (var p = 0; p < rows.payments; p++) {
    var mem2 = members[pareto_(members.length)];
    var due = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 10);
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age <= 20) status2 = pickW_([['Paid', 72], ['Pending', 18], ['Overdue', 10]]);
    else status2 = pickW_([['Paid', 95], ['Overdue', 5]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 5)); if (pd > TODAY_) pd = daysAgo_(0); paid = pd; }
    out.payments.push([mem2.name, mem2.plan, mem2.fee, due, paid, status2]);
  }
  return out;
}

/* ---------------------------------------------------------------- 08 · SCHOOL --------------- */
function genSchool_(rows) {
  var out = { students: [], attendance: [], fees: [] };
  var grades = ['Nursery','KG','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5',
                'Grade 6','Grade 7','Grade 8','Grade 9','Grade 10'];
  var feeFor = function (g) {
    var idx = grades.indexOf(g);
    return 8500 + Math.round(idx * 1600 / 100) * 100 + rint_(0, 2) * 500;
  };
  var students = [];

  for (var s = 0; s < rows.students; s++) {
    var grade = pick_(grades);
    var name = pName_();
    var fee = feeFor(grade);
    var joined = rnd_() < 0.35 ? daysAgo_(rint_(0, 120)) : daysAgo_(rint_(120, 900));
    var status = pickW_([['Enrolled', 95], ['Left', 3], ['Graduated', 2]]);
    students.push({ name: name, grade: grade, fee: fee, status: status });
    out.students.push([
      'S-' + (5000 + s), name, grade, pick_(['A','B','C']), joined,
      pName_(), fee, status,
    ]);
  }

  // attendance: school days only (Mon–Fri)
  var attTarget = rows.attendance;
  var att = [];
  for (var back = SEED_CONFIG.MONTHS * 30; back >= 0; back--) {
    var d = daysAgo_(back, 9);
    if (isWeekend_(d)) continue;
    var n = rint_(4, 9);
    for (var k = 0; k < n; k++) {
      var st = students[rint_(0, students.length - 1)];
      att.push([new Date(d.getTime()), st.name, st.grade, rnd_() < 0.92 ? 'Yes' : 'No']);
    }
  }
  out.attendance = att.slice(-attTarget);

  // fees: one row per student per month, with arrears on recent months
  for (var f = 0; f < rows.fees; f++) {
    var stu = students[rint_(0, students.length - 1)];
    var monthsAgo = rint_(0, SEED_CONFIG.MONTHS);
    var due = new Date(TODAY_.getFullYear(), TODAY_.getMonth() - monthsAgo, 5);
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age < 0) status2 = 'Pending';
    else if (monthsAgo === 0) status2 = pickW_([['Paid', 62], ['Pending', 26], ['Overdue', 12]]);
    else status2 = pickW_([['Paid', 94], ['Overdue', 6]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 12)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 2)); paid = pd; }
    out.fees.push([
      stu.name, stu.grade,
      due.getFullYear() + '-' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][due.getMonth()],
      stu.fee, due, paid, status2,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 09 · CLINIC --------------- */
function genClinic_(rows) {
  var out = { appointments: [], patients: [], treatments: [] };
  var providers = ['Dr. Farhan Ali','Dr. Sana Qureshi','Dr. Imran Sheikh','Dr. Areeba Malik'];
  var treatments = [
    ['Consultation','General',2500,1200,30], ['Scaling & Polishing','Hygiene',8500,3000,45],
    ['Composite Filling','Restorative',12000,4000,45], ['Root Canal (RCT)','Endodontics',35000,12000,90],
    ['Crown – Zirconia','Prosthodontics',55000,22000,60], ['Extraction','Surgery',15000,5000,40],
    ['Dental Implant','Implants',180000,75000,120], ['Orthodontics (Braces)','Orthodontics',240000,90000,60],
    ['Teeth Whitening','Cosmetic',28000,9000,60], ['Veneers (per tooth)','Cosmetic',45000,18000,75],
    ['Child Checkup','Pediatric',3000,1000,30], ['Denture Set','Prosthodontics',85000,32000,90],
  ];
  var sources = ['Walk-in','Referral','Instagram','Google','Facebook','Corporate Panel'];
  var patients = [];

  for (var p = 0; p < rows.patients; p++) {
    var name = pName_();
    var firstVisit = daysAgo_(rint_(0, 900));
    var visits = 1 + pareto_(11);
    patients.push({ name: name, visits: visits });
    out.patients.push([
      'P-' + (800 + p), name, pPhone_(), firstVisit, visits, pick_(sources),
    ]);
  }

  for (var t = 0; t < rows.treatments; t++) {
    var tr = treatments[t % treatments.length];
    out.treatments.push([
      tr[0], tr[1], roundTo_(tr[2] * (0.95 + rnd_() * 0.15), 500),
      roundTo_(tr[3], 500), rint_(10, 260),
    ]);
  }

  // Clinics are shut or quiet at weekends: thin out Saturday and drop most of Sunday,
  // otherwise the weekday chart reads flat, which no practice manager would believe.
  var apptDates = seasonWeightedDates_('clinic', rows.appointments, false).filter(function (d) {
    if (d.getDay() === 0) return rnd_() < 0.15;
    if (d.getDay() === 6) return rnd_() < 0.55;
    return true;
  });

  for (var a = 0; a < apptDates.length; a++) {
    var pat = patients[pareto_(patients.length)];
    var trt = treatments[rint_(0, treatments.length - 1)];
    var status = pickW_([['Completed', 76], ['Scheduled', 10], ['No Show', 9], ['Cancelled', 5]]);
    var fee = roundTo_(trt[2] * (0.95 + rnd_() * 0.2), 500);
    // unpaid completed visits become receivables — some deliberately old
    var date = apptDates[a];

    // Collected-status depends on AGE: recent visits often still owe money, old ones are settled.
    // (Without this, 18 months of unpaid visits pile into a fake 5-month AR balance.)
    var preAge = Math.round((TODAY_ - date) / 86400000);
    if (status === 'Completed') {
      var unpaidChance = preAge < 45 ? 0.32 : preAge < 90 ? 0.10 : 0.02;
      var roll2 = rnd_();
      if (roll2 > unpaidChance) status = 'Paid';
      else status = roll2 > unpaidChance * 0.35 ? 'Unpaid' : 'Partial';
    }
    if (status === 'Scheduled') date = daysFromToday_(rint_(0, 21), rint_(10, 18));
    else if (status === 'Unpaid' && a % 60 === 0) date = daysAgo_(rint_(95, 130), 12);  // a little stale AR

    // Anything older than ~5 months has effectively been settled or written off — without this
    // the AR figure grows for 18 months and stops resembling a real practice.
    var ageDays = Math.round((TODAY_ - date) / 86400000);
    if (ageDays > 150 && (status === 'Unpaid' || status === 'Partial')) {
      status = rnd_() < 0.94 ? 'Paid' : 'Unpaid';   // old debt is settled or written off
    }

    out.appointments.push([
      date, pat.name, pick_(providers), trt[0], status, fee, trt[4],
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 10 · TRAVEL --------------- */
function genTravel_(rows) {
  var out = { bookings: [], packages: [], payments: [] };
  var destinations = [
    ['Dubai', 'UAE', 320000], ['Istanbul', 'Turkey', 480000], ['Kuala Lumpur', 'Malaysia', 420000],
    ['Bangkok', 'Thailand', 380000], ['Umrah', 'Saudi Arabia', 310000], ['Hunza & Skardu', 'Pakistan', 165000],
    ['Baku', 'Azerbaijan', 445000], ['Maldives', 'Maldives', 620000], ['London', 'UK', 950000],
  ];
  var types = ['Family Package','Honeymoon','Group Tour','Umrah Package','Corporate Retreat','Visa + Tickets'];
  var agents = ['Hamza (Corporate)','Nida','Faisal','Rabia'];

  for (var p = 0; p < rows.packages; p++) {
    var dest = destinations[p % destinations.length];
    out.packages.push([
      dest[0] + ' ' + pick_(['4N/5D','7N/8D','5N/6D','10N/11D']),
      dest[0] + ', ' + dest[1], pick_(types),
      roundTo_(dest[2] * (0.9 + rnd_() * 0.5), 5000),
      roundTo_(dest[2] * (0.72 + rnd_() * 0.12), 5000),
      rint_(3, 90),
    ]);
  }

  var bookingDates = seasonWeightedDates_('travel', rows.bookings, false);
  for (var b = 0; b < bookingDates.length; b++) {
    var dest2 = destinations[rint_(0, destinations.length - 1)];
    var pax = pickW_([[1, 18], [2, 34], [3, 16], [4, 18], [5, 8], [6, 6]]);
    var value = roundTo_(dest2[2] * pax * (0.9 + rnd_() * 0.35), 5000);
    var cost = roundTo_(value * (0.83 + rnd_() * 0.08), 5000);
    var status = pickW_([['Confirmed', 72], ['Deposit Paid', 14], ['Enquiry', 6], ['Cancelled', 6], ['Completed', 2]]);
    out.bookings.push([
      'BK-' + (3300 + b), bookingDates[b], pName_(),
      dest2[0] + ', ' + dest2[1], pick_(types), pax, value, cost, status,
      pick_(agents),
    ]);
  }

  for (var pay = 0; pay < rows.payments; pay++) {
    var bk = out.bookings[rint_(0, out.bookings.length - 1)];
    var due = seasonWeightedDates_('travel', 1, false)[0];
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age < 0) status2 = 'Pending';
    else if (age <= 45) status2 = pickW_([['Paid', 70], ['Pending', 20], ['Overdue', 10]]);
    else status2 = pickW_([['Paid', 95], ['Overdue', 5]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 8)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 2)); paid = pd; }
    out.payments.push([
      bk[0], bk[2], roundTo_(toNumberSafe_(bk[6]) * pick_([0.3, 0.3, 0.4, 0.5]), 1000),
      due, paid, status2,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 11 · CONSTRUCTION --------- */
function genConstruction_(rows) {
  var out = { projects: [], expenses: [], invoices: [] };
  var types = ['Commercial Plaza','Residential Tower','Warehouse','Bungalow','School Extension',
               'Road Works','Factory Shed','Hospital Wing'];
  var cats = ['Materials','Labour','Subcontractor','Equipment Hire','Transport','Permits & Fees','Fuel'];
  var vendors = ['Thatta Cement','Lucky Cement Dealer','Mughal Steel','Karachi Sand Supply',
    'Al-Noor Electricals','Sindh Equipment Rentals','Local Labour Contractor'];

  var names = [];
  for (var p = 0; p < rows.projects; p++) {
    var name = pick_(types) + ' – ' + pick_(KARACHI_AREAS);
    var contract = roundTo_(10000000 + Math.pow(rnd_(), 1.8) * 190000000, 100000);
    var start = daysAgo_(rint_(60, 900));
    var end = daysFromToday_(rint_(-180, 400));
    var progress = Math.min(100, Math.max(5, Math.round((daysAgo_(0) - start) / (end - start) * 100 + rint_(-12, 12))));
    var billed = roundTo_(contract * (progress / 100) * (0.85 + rnd_() * 0.2), 10000);
    var cost = roundTo_(billed * (0.78 + rnd_() * 0.17), 10000);       // 5–22% gross margin
    if (p % 9 === 0) cost = roundTo_(billed * 1.04, 10000);            // one project over budget
    var status = progress >= 100 ? 'Completed' : pickW_([['In Progress', 78], ['On Hold', 12], ['Delayed', 10]]);
    names.push({ name: name, contract: contract });
    out.projects.push([
      'PRJ-' + (400 + p), name, pCompany_(), contract, start, end, progress, billed, cost, status,
    ]);
  }

  for (var e = 0; e < rows.expenses; e++) {
    var prj = names[pareto_(names.length)];
    out.expenses.push([
      daysAgo_(rint_(0, 540), 14), prj.name, pick_(cats),
      roundTo_(50000 + Math.pow(rnd_(), 2) * 4500000, 1000), pick_(vendors),
    ]);
  }

  for (var i = 0; i < rows.invoices; i++) {
    var prj2 = names[pareto_(names.length)];
    var due = daysAgo_(rint_(0, 540), 12);
    var amount = roundTo_(prj2.contract * (0.04 + rnd_() * 0.12), 10000);
    var retention = roundTo_(amount * (0.05 + rnd_() * 0.05), 1000);   // 5–10% retainage
    var age = Math.round((TODAY_ - due) / 86400000);
    var status, paid = '';
    if (age < 0) status = 'Pending';
    else if (age <= 60) status = pickW_([['Paid', 55], ['Pending', 25], ['Overdue', 20]]);
    else status = pickW_([['Paid', 88], ['Overdue', 12]]);
    if (status === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 25)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 3)); paid = pd; }
    out.invoices.push([
      'CI-' + (900 + i), prj2.name, amount, retention, due, paid, status,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 12 · PHOTOGRAPHY ---------- */
function genPhotography_(rows) {
  var out = { events: [], bookings: [], expenses: [] };
  var types = [['Wedding', 6], ['Mehndi', 4], ['Nikkah', 3], ['Corporate Event', 3],
               ['Portrait Session', 4], ['Product Shoot', 3], ['Birthday', 2]];
  var packages = ['Silver','Gold','Platinum','Signature'];
  var venues = ['Pearl Continental','Marriott Karachi','Movenpick','Beach Wedding – French Beach',
    'Fortress Stadium','Private Bungalow DHA','Mohatta Palace','Local Marquee'];
  var sources = [['Referral', 35], ['Instagram', 24], ['Past Client', 16],
                 ['Facebook', 10], ['Google', 8], ['Wedding Portal', 7]];

  var bookingDates = seasonWeightedDates_('photo', rows.bookings, false);
  for (var b = 0; b < bookingDates.length; b++) {
    var type = pickW_(types);
    var value = roundTo_(65000 + Math.pow(rnd_(), 1.5) * 780000, 5000);
    var status = pickW_([['Confirmed', 62], ['Tentative', 18], ['Completed', 14], ['Cancelled', 6]]);
    out.bookings.push([
      bookingDates[b], pName_(), type, daysFromToday_(rint_(-120, 180), 12), value,
      pickW_(sources), status,
    ]);
  }

  var eventDates = seasonWeightedDates_('photo', rows.events, false);
  for (var e = 0; e < eventDates.length; e++) {
    var type2 = pickW_(types);
    var revenue = roundTo_(75000 + Math.pow(rnd_(), 1.5) * 720000, 5000);
    var cost = roundTo_(revenue * (0.22 + rnd_() * 0.16), 1000);
    var status2 = eventDates[e] < TODAY_
      ? pickW_([['Delivered', 72], ['Editing', 24], ['Awaiting Selection', 4]])
      : 'Scheduled';
    out.events.push([
      eventDates[e], pName_(), type2, pick_(venues), pick_(packages), revenue, cost, status2,
    ]);
  }

  for (var x = 0; x < rows.expenses; x++) {
    out.expenses.push([
      daysAgo_(rint_(0, 540), 12),
      pick_(['Equipment','Travel','Studio Rent','Editing Software','Props','Marketing','Team Wages']),
      roundTo_(5000 + Math.pow(rnd_(), 1.6) * 180000, 500),
      pick_(['Camera rental','Client shoot travel','Monthly studio','Adobe CC','Prop purchase','Instagram ads','Second shooter']),
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 13 · SaaS ------------------ */
function genSaas_(rows) {
  var out = { subscriptions: [], invoices: [], tickets: [] };
  var plans = [['Starter', 8500, 6], ['Growth', 26000, 18], ['Scale', 68000, 45], ['Enterprise', 185000, 120]];
  var customers = [];

  for (var s = 0; s < rows.subscriptions; s++) {
    var plan = pickW_([[plans[0], 34], [plans[1], 32], [plans[2], 22], [plans[3], 12]]);
    var name = pCompany_() + (rnd_() < 0.4 ? ' ' + pick_(['Tech','Systems','Digital','Labs']) : '');
    var start = daysAgo_(rint_(20, 900));
    var churned = rnd_() < 0.10;
    var churnDate = churned ? daysAgo_(rint_(1, Math.min(400, Math.round((TODAY_ - start) / 86400000)))) : '';
    var seats = Math.max(1, Math.round(plan[2] * (0.6 + rnd_() * 0.9)));
    customers.push({ name: name, plan: plan[0], mrr: plan[1], seats: seats });
    out.subscriptions.push([
      'SUB-' + (6000 + s), name, plan[0], plan[1], seats, start,
      churnDate, churned ? 'Churned' : 'Active',
    ]);
  }

  for (var i = 0; i < rows.invoices; i++) {
    var c = customers[rint_(0, customers.length - 1)];
    var due = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 10);
    var amount = roundTo_(c.mrr * pick_([1, 1, 1, 3, 12]), 500);      // monthly, quarterly, annual
    var age = Math.round((TODAY_ - due) / 86400000);
    var status, paid = '';
    if (age < 0) status = 'Pending';
    else if (age <= 30) status = pickW_([['Paid', 78], ['Pending', 12], ['Overdue', 10]]);
    else status = pickW_([['Paid', 96], ['Overdue', 4]]);
    if (status === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 7)); if (pd > TODAY_) pd = daysAgo_(0); paid = pd; }
    out.invoices.push(['SI-' + (7000 + i), c.name, amount, due, paid, status]);
  }

  for (var t = 0; t < rows.tickets; t++) {
    var c2 = customers[rint_(0, customers.length - 1)];
    var opened = daysAgo_(rint_(0, 300), 11);
    var priority = pickW_([['Low', 40], ['Medium', 34], ['High', 18], ['Urgent', 8]]);
    var resolved = rnd_() < 0.82 ? new Date(opened.getTime() + rint_(1, 60) * 3600000) : '';
    if (resolved && resolved > new Date()) resolved = '';
    out.tickets.push([
      'TKT-' + (20000 + t), c2.name, priority, opened, resolved,
      resolved ? pick_([3, 4, 4, 5, 5, 5]) : '',
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 14 · LOGISTICS ------------- */
function genLogistics_(rows) {
  var out = { shipments: [], clients: [], invoices: [] };
  var lanes = [['Karachi','Lahore',185000],['Karachi','Islamabad',225000],['Karachi','Faisalabad',165000],
               ['Karachi','Multan',155000],['Karachi','Peshawar',245000],['Lahore','Karachi',180000],
               ['Karachi','Quetta',195000],['Karachi','Hyderabad',65000],['Karachi','Sialkot',175000]];
  var modes = ['FTL','LTL','Parcel','Cold Chain','Express'];
  var tiers = ['Key Account','Growth','SME'];

  var clientNames = [];
  for (var c = 0; c < rows.clients; c++) {
    var name = pCompany_();
    clientNames.push(name);
    out.clients.push([
      name, pickW_([['Key Account', 15], ['Growth', 40], ['SME', 45]]),
      rint_(20, 900), roundTo_(2000000 + Math.pow(rnd_(), 1.8) * 60000000, 100000),
      daysAgo_(rint_(200, 2000)),
    ]);
  }

  var shipDates = seasonWeightedDates_('freight', rows.shipments, false);
  for (var s = 0; s < shipDates.length; s++) {
    var lane = lanes[rint_(0, lanes.length - 1)];
    var weight = roundTo_(500 + Math.pow(rnd_(), 1.6) * 24000, 50);
    var revenue = roundTo_(lane[2] * (0.6 + rnd_() * 0.9), 1000);
    var cost = roundTo_(revenue * (0.70 + rnd_() * 0.17), 1000);
    var ontime = rnd_() < 0.92;
    var status = ontime ? pickW_([['Delivered', 94], ['In Transit', 6]])
                        : pickW_([['Delayed', 52], ['In Transit', 30], ['Exception', 14], ['Returned', 4]]);
    out.shipments.push([
      'SHP-' + (70000 + s), shipDates[s], clientNames[pareto_(clientNames.length)],
      lane[0], lane[1], pick_(modes), weight, revenue, cost,
      ontime ? 'Yes' : 'No', status,
    ]);
  }

  for (var i = 0; i < rows.invoices; i++) {
    var due = daysAgo_(rint_(0, 540), 12);
    var amount = roundTo_(120000 + Math.pow(rnd_(), 1.7) * 3400000, 1000);
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age < 0) status2 = 'Pending';
    else if (age <= 45) status2 = pickW_([['Paid', 62], ['Pending', 20], ['Overdue', 18]]);
    else status2 = pickW_([['Paid', 93], ['Overdue', 7]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 20)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 2)); paid = pd; }
    out.invoices.push([
      'LF-' + (4400 + i), clientNames[pareto_(clientNames.length)], amount, due, paid, status2,
    ]);
  }
  return out;
}

/* ---------------------------------------------------------------- 15 · LAW FIRM ------------- */
function genLawFirm_(rows) {
  var out = { matters: [], time: [], invoices: [] };
  var areas = ['Corporate','Litigation','Family','Property','Tax','Employment'];
  var partners = ['Sara Ahmed (Partner)','Kamran Sheikh (Partner)','Nadia Iqbal (Partner)','Adnan Raza (Senior)'];
  var timekeepers = ['Sara Ahmed','Kamran Sheikh','Nadia Iqbal','Adnan Raza','Associate – Zain','Associate – Mahnoor','Paralegal – Faiza'];
  var feeTypes = ['Hourly','Fixed Fee','Retainer'];

  var matters = [];
  for (var m = 0; m < rows.matters; m++) {
    var area = pick_(areas);
    var client = pCompany_();
    var opened = daysAgo_(rint_(10, 700));
    var status = pickW_([['Open', 62], ['On Hold', 8], ['Closed', 30]]);
    var budget = roundTo_(250000 + Math.pow(rnd_(), 1.6) * 6500000, 50000);
    matters.push({ id: 'M-' + (1200 + m), area: area, client: client });
    out.matters.push([
      'M-' + (1200 + m), client, area, pick_(partners), opened, status, pick_(feeTypes), budget,
    ]);
  }

  // time entries: weekdays only, 3–11 per day, 0.5h increments
  var timeTarget = rows.time;
  var entries = [];
  for (var back = SEED_CONFIG.MONTHS * 30; back >= 0; back--) {
    var d = daysAgo_(back, 17);
    if (isWeekend_(d)) continue;
    var n = rint_(3, 9);
    for (var k = 0; k < n; k++) {
      var mat = matters[rint_(0, matters.length - 1)];
      var hours = pick_([0.5, 1, 1, 1.5, 2, 2.5, 3, 4]);
      var rate = roundTo_(pick_([15000, 18000, 22000, 28000, 35000, 45000]), 1000);
      entries.push([
        new Date(d.getTime()), mat.id, pick_(timekeepers), hours, rate,
        rnd_() < 0.88 ? 'Yes' : 'No',
      ]);
    }
  }
  out.time = entries.slice(-timeTarget);

  // Worked value per matter — invoices are progress bills against it, which keeps
  // realisation rate (~85–92%) and WIP believable instead of invented.
  var workedByMatter = {};
  out.time.forEach(function (t) {
    workedByMatter[t[1]] = (workedByMatter[t[1]] || 0) + toNumberSafe_(t[3]) * toNumberSafe_(t[4]);
  });

  // Only matters with recorded time can be billed against.
  var billableMatters = matters.filter(function (m) { return (workedByMatter[m.id] || 0) > 0; });
  if (!billableMatters.length) billableMatters = matters;

  for (var i = 0; i < rows.invoices; i++) {
    var mat2 = billableMatters[i % billableMatters.length];   // even spread across the book
    var worked = workedByMatter[mat2.id] || 0;
    var due = daysAgo_(rint_(0, 540), 12);
    var amount = roundTo_(worked * (0.18 + rnd_() * 0.10), 5000);   // progress billing
    var age = Math.round((TODAY_ - due) / 86400000);
    var status2, paid = '';
    if (age < 0) status2 = 'Pending';
    else if (age <= 60) status2 = pickW_([['Paid', 55], ['Pending', 22], ['Overdue', 23]]);
    else status2 = pickW_([['Paid', 90], ['Overdue', 10]]);
    if (status2 === 'Paid') { var pd = new Date(due.getTime()); pd.setDate(pd.getDate() + rint_(0, 35)); if (pd > TODAY_) pd = daysAgo_(rint_(0, 3)); paid = pd; }
    out.invoices.push([
      'LF-' + (8000 + i), mat2.client, amount, due, paid, status2,
    ]);
  }
  return out;
}

/** Small helper used above when reading back a generated number. */
function toNumberSafe_(v) { var n = Number(v); return isFinite(n) ? n : 0; }

/** slug → generator */

/* ---------------------------------------------------------------- 16 · HOTEL ----------------- */
function genHotel_(rows) {
  var out = { stays: [], rooms: [], expenses: [] };
  var types = [['Deluxe', 40], ['Premier', 26], ['Executive Suite', 12], ['Family Room', 14], ['Garden Villa', 8]];
  var channels = [['Direct', 26], ['Booking.com', 24], ['Agoda', 16], ['Corporate', 18], ['Walk-in', 9], ['Airbnb', 7]];
  var guestFirst = FIRST, guestLast = LAST;

  // ---- room inventory (a real boutique property: 40–48 keys) ----
  var roomNo = 101;
  for (var r = 0; r < rows.rooms; r++) {
    var type = pickW_(types);
    var rack = type === 'Executive Suite' ? 52000 : type === 'Garden Villa' ? 61000 :
                type === 'Premier' ? 34000 : type === 'Family Room' ? 29000 : 23500;
    out.rooms.push([
      String(roomNo), type, roundTo_(rack * (0.9 + rnd_() * 0.25), 500),
      String(1 + Math.floor(r / 14)),
      pickW_([['Available', 70], ['Occupied', 22], ['Maintenance', 8]]),
    ]);
    roomNo = (r % 14 === 13) ? roomNo + 100 - 13 : roomNo + 1;
  }

  // ---- bookings: weekday shape (Thu–Sat heavy), wedding season and summer holidays ----
  var totalNights = 0;
  for (var b = 0; b < rows.stays; b++) {
    var checkin = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30));
    var dow = checkin.getDay();
    if (dow === 5 || dow === 6) checkin = new Date(checkin.getTime() - 86400000);   // pull weekends in
    var inHouse = daysAgo_(0) <= checkin;
    var type2 = pickW_(types);
    var base = type2 === 'Executive Suite' ? 48000 : type2 === 'Garden Villa' ? 56000 :
               type2 === 'Premier' ? 31500 : type2 === 'Family Room' ? 27000 : 21500;
    var seasonal = 1 + (checkin.getMonth() >= 9 || checkin.getMonth() <= 1 ? 0.18 : 0) + (rnd_() - 0.5) * 0.16;
    var nights = pickW_([[1, 34], [2, 30], [3, 18], [4, 10], [5, 5], [7, 3]]);
    var rate = roundTo_(base * seasonal, 500);
    var amount = rate * nights;
    var status = isPast_(checkin) ?
      pickW_([['Checked Out', 88], ['Cancelled', 6], ['No-show', 4], ['In-house', 2]]) :
      pickW_([['Confirmed', 78], ['Tentative', 14], ['Cancelled', 8]]);
    if (status === 'Checked Out' && rnd_() < 0.08) status = 'Balance Due';

    out.stays.push([
      checkin, addDays_(checkin, nights),
      pick_(guestFirst) + ' ' + pick_(guestLast),
      type2, String(rint_(101, 214)), nights, rate, amount,
      pickW_(channels), status,
    ]);
    totalNights += nights;
  }

  var cats = ['Utilities', 'Housekeeping', 'F&B Cost', 'OTA Commission', 'Maintenance', 'Marketing', 'Salaries — extra'];
  var vendors = ['K-Electric', 'SSGC', 'Metro Cash & Carry', 'Unilever Professional', 'Bookings.com',
    'Agoda Payments', 'Cool Point AC Services', 'Linen House', 'Green Leaf Laundry'];
  for (var e = 0; e < rows.expenses; e++) {
    var cat = pick_(cats);
    var amount2 = roundTo_(cat === 'Salaries — extra' ? 90000 + rnd_() * 260000 : 12000 + Math.pow(rnd_(), 1.7) * 340000, 500);
    out.expenses.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12), cat, amount2, pick_(vendors),
      pick_(['Monthly', 'Restock', 'Repair', 'Campaign', 'Quarterly'])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 17 · FACTORY --------------- */
function genFactory_(rows) {
  var out = { production: [], downtime: [], orders: [] };
  var lines = ['Line A — 250T', 'Line B — 180T', 'Line C — 120T'];
  var shifts = ['Morning', 'Evening', 'Night'];
  var idealByLine = { 'Line A — 250T': 34, 'Line B — 180T': 26, 'Line C — 120T': 18 };   // parts per minute
  // Older machines run slower and scrap more — without this, every line reports the same OEE.
  var healthByLine = { 'Line A — 250T': 1.00, 'Line B — 180T': 0.93, 'Line C — 120T': 0.82 };
  var reasons = [['Mould change', 26], ['Material shortage', 15], ['Machine fault', 18], ['Power outage', 14],
    ['Quality hold', 10], ['Manpower', 8], ['Planned maintenance', 9]];

  // one row per line per shift per working day, ~ 200 days back
  var days = Math.floor(rows.production / (lines.length * shifts.length));
  for (var d = days; d >= 0; d--) {
    var date = daysAgo_(d, 6);
    for (var li = 0; li < lines.length; li++) {
      for (var s = 0; s < shifts.length; s++) {
        var plannedMin = 450 + rint_(-10, 20);
        var downMin = rnd_() < 0.34 ? rint_(12, 145) : (rnd_() < 0.5 ? rint_(0, 12) : 0);
        downMin = Math.round(downMin / healthByLine[lines[li]]);
        var runMin = Math.max(120, plannedMin - downMin - rint_(10, 35));
        var ideal = idealByLine[lines[li]];
        var perf = (0.86 + rnd_() * 0.14) * healthByLine[lines[li]];   // performance 86–100%, per machine
        var total = Math.round(runMin * ideal * perf);
        var rejectRate = (0.008 + Math.pow(rnd_(), 2) * 0.055) / healthByLine[lines[li]];  // 0.8–7%
        if (rnd_() < 0.06) rejectRate += 0.03;               // occasional bad batch
        var reject = Math.round(total * rejectRate);
        out.production.push([date, lines[li], shifts[s], plannedMin, runMin, total - reject, reject, downMin, ideal]);

        if (downMin > 25) {
          out.downtime.push([date, lines[li], pickW_(reasons), downMin,
            pick_(['Tooling replaced', 'Awaiting granulate', 'Hydraulic leak', 'Load-shedding',
                   'First-off inspection', 'Operator absent', 'Scheduled service'])]);
        }
      }
    }
  }

  var parts = ['Crate Lid 12L', 'Housing Cap A2', 'Bottle Preform 500ml', 'Bucket Handle',
    'Container Base 5L', 'Closure Ring 38mm', 'Tray Insert', 'Cable Spool Core',
    'Dustbin Body 20L', 'Pallet Corner'];
  for (var o = 0; o < rows.orders; o++) {
    var qty = roundTo_(4000 + Math.pow(rnd_(), 1.5) * 180000, 500);
    var unit = 9 + rnd_() * 34;                              // Rs 9–43 per part
    var due = daysAgo_(rint_(-25, 60), 17);
    var status = due < TODAY_ ? pickW_([['Delivered', 82], ['In Production', 8], ['Past Due', 10]]) :
      pickW_([['In Production', 55], ['Scheduled', 33], ['Delivered', 12]]);
    out.orders.push([daysAgo_(rint_(0, 120), 11), pCompany_(), pick_(parts), qty,
      roundTo_(qty * unit, 1000), due, status]);
  }
  return out;
}

/* ---------------------------------------------------------------- 18 · RECRUITMENT ----------- */
function genRecruitment_(rows) {
  var out = { roles: [], candidates: [], invoices: [] };
  var titles = ['Senior Accountant', 'Area Sales Manager', 'Embedded Engineer', 'HR Business Partner',
    'Supply Chain Analyst', 'Frontend Developer', 'Plant Supervisor', 'Brand Manager',
    'Internal Auditor', 'QA Engineer', 'Finance Controller', 'Customer Success Lead',
    'Warehouse Manager', 'Digital Marketing Specialist', 'Mechanical Design Engineer'];
  var stages = [['Applied', 30], ['Screening', 22], ['Shortlisted', 16], ['Interview', 18], ['Offer', 8],
    ['Placed', 4], ['Rejected', 2]];
  var sources = ['LinkedIn', 'Referral', 'Bayt', 'Rozee', 'Company Database', 'Walk-in', 'Facebook Groups'];

  var openRoles = [];
  for (var r = 0; r < rows.roles; r++) {
    var opened = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 10);
    var salary = roundTo_(180000 + Math.pow(rnd_(), 1.6) * 3200000, 10000);
    var feePct = pickW_([[15, 20], [18, 26], [20, 24], [22, 16], [25, 10], [30, 4]]);
    var fee = roundTo_(salary * feePct / 100, 1000);
    var status, filled = '';
    var age = -daysBetween_(TODAY_, opened);
    if (age > 60 && rnd_() < 0.86) {
      status = rnd_() < 0.82 ? 'Filled' : 'Lost';
      // Real desks close a non-executive role in 25–60 days; fill dates must sit inside that band.
      if (status === 'Filled') {
        var ttf = Math.min(age - 1, rint_(18, 62));
        filled = daysAgo_(age - ttf, 15);
      }
    } else {
      status = pickW_([['Open', 62], ['Interviewing', 20], ['Offer Out', 8], ['On Hold', 6], ['Lost', 4]]);
      if (status === 'Lost') filled = '';
    }
    var title = pick_(titles);
    out.roles.push([opened, pCompany_(), title, salary, feePct, fee, status, filled]);
    if (status !== 'Filled' && status !== 'Lost') openRoles.push(title);
  }

  // Guarantee a live month: spread a dozen fills across the last 30 days so "fees this month"
  // and the fee-trend chart are never empty — a recruiter always has something closing.
  var recentFills = 0;
  for (var rf = 0; rf < out.roles.length && recentFills < 12; rf++) {
    var row = out.roles[rf];
    if (row[6] !== 'Filled' && row[6] !== 'Lost') continue;
    if (-daysBetween_(TODAY_, row[0]) < 40) continue;            // role must be old enough to close
    var closedAgo = rint_(0, 27);
    row[0] = daysAgo_(closedAgo + rint_(21, 55), 10);            // opened 3–8 weeks before it closed
    row[6] = 'Filled';
    row[7] = daysAgo_(closedAgo, 16);
    recentFills++;
  }

  var owners = ['Areeba S.', 'Danish A.', 'Komal F.', 'Usman T.', 'Hira K.'];
  for (var c = 0; c < rows.candidates; c++) {
    var st = pickW_(stages);
    out.candidates.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12), pName_(),
      openRoles.length ? pick_(openRoles) : pick_(titles), st, pick_(sources), pick_(owners)]);
  }

  // An invoice IS the placement fee for a filled role — never an invented amount.
  var filledRoles = out.roles.filter(function (r) { return r[6] === 'Filled'; });
  for (var i = 0; i < rows.invoices; i++) {
    var role = filledRoles.length ? filledRoles[rint_(0, filledRoles.length - 1)] : null;
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 13);
    var amount = role ? role[5] : roundTo_(300000 + rnd_() * 900000, 1000);
    var due = addDays_(dt, 15);
    var paid = rnd_() < (isPast_(due) ? 0.86 : 0.22) ? addDays_(dt, rint_(3, 30)) : '';
    var status = paid && paid <= TODAY_ ? 'Paid' : (isPast_(due) ? pickW_([['Overdue', 78], ['Partial', 22]]) : 'Pending');
    out.invoices.push([dt, role ? role[1] : pCompany_(), role ? role[2] : pick_(titles), amount, due, paid, status]);
  }
  return out;
}

/* ---------------------------------------------------------------- 19 · PHARMACY -------------- */
function genPharmacy_(rows) {
  var out = { sales: [], inventory: [], purchases: [] };
  var cats = ['Antibiotics', 'Analgesics', 'Cardiac', 'Diabetes', 'Gastro', 'Dermatology',
    'Vitamins', 'Respiratory', 'Baby Care', 'First Aid'];
  var brandNames = ['Panadol', 'Augmentin', 'Risek', 'Concor', 'Glucophage', 'Velosef', 'Motilium',
    'Zyrtec', 'Calpol', 'Ventolin', 'Surbex-Z', 'Brufen', 'Ciproxin', 'Zoloft', 'Insulin Mixtard',
    'Omez', 'Tinidazole', 'Losartan', 'Atorva', 'Nasonex', 'Betnovate', 'Dextrose', 'Face Mask',
    'Surgical Gloves', 'Bandage Roll', 'ORS Sachet', 'Baby Lotion', 'Multivitamin Syrup'];

  // ---- daily dispensing: weekends quieter, Ramadan evenings busier ----
  for (var d = rows.sales; d >= 0; d--) {
    var date = daysAgo_(d, 19);
    var weekend = isWeekend_(date) ? 0.86 : 1;
    var rx = Math.round((196 + rnd_() * 52) * weekend * season_(date, 'clinic'));
    var rxSales = roundTo_(rx * (300 + rnd_() * 120), 100);
    var otcSales = roundTo_((45000 + rnd_() * 55000) * weekend, 100);
    var cost = roundTo_((rxSales + otcSales) * (0.775 + rnd_() * 0.028), 100);   // ~20% blended margin
    out.sales.push([date, rx, rxSales, otcSales, cost, (rxSales + otcSales) - cost]);
  }

  // ---- inventory: a few lines always below reorder, a handful close to expiry ----
  for (var i = 0; i < rows.inventory; i++) {
    var brand = brandNames[i % brandNames.length] + (i >= brandNames.length ? ' ' + pick_(['500mg', '250mg', 'Plus', 'SR', 'Forte']) : '');
    var cost2 = roundTo_(18 + Math.pow(rnd_(), 1.8) * 900, 5);
    var reorder = rint_(10, 40);
    // Normally 2–12× the reorder level; roughly 4% of lines are genuinely short.
    var qty = rnd_() < 0.04 ? rint_(0, reorder) : Math.round(reorder * (1.1 + Math.pow(rnd_(), 1.3) * 3));
    var nearExpiry = rnd_() < 0.045;
    if (nearExpiry) qty = Math.min(qty, rint_(5, 40));       // short-dated stock is never a full shelf
    out.inventory.push([
      brand, pick_(cats), qty, cost2, roundTo_(cost2 * (1.18 + rnd_() * 0.14), 5), reorder,
      nearExpiry ? daysFromToday_(rint_(10, 88)) : daysFromToday_(rint_(150, 900)),
    ]);
  }

  var dists = ['Muller & Phipps', 'Sapphire Pharma', 'Pharma Health', 'Highnoon Distributors',
    'Getz Pharma', 'Bio-Labs', 'Nova Medix', 'Aga Khan Supplies'];
  for (var p = 0; p < rows.purchases; p++) {
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12);
    var amount = roundTo_(80000 + Math.pow(rnd_(), 1.4) * 1600000, 500);
    var due = addDays_(dt, rint_(15, 45));
    var st = rnd_() < (isPast_(due) ? 0.8 : 0.3) ? 'Paid' : (isPast_(due) ? 'Overdue' : 'Pending');
    out.purchases.push([dt, pick_(dists), amount, rint_(12, 140), st, due]);
  }
  return out;
}

/* ---------------------------------------------------------------- 20 · POULTRY -------------- */
function genPoultry_(rows) {
  var out = { flocks: [], daily: [], sales: [] };
  var buyers = ['Al-Safa Chicken Shop', 'Bismillah Meat Traders', 'Metro Cash & Carry',
    'K&Ns Depot', 'Local Butchers Association', 'Hotel Supply Co', 'Sabzi Mandi Wholesale'];

  var batchIds = [];
  // ~6-week cycles over 18 months → about 13 batches, plus a couple running now
  for (var f = 0; f < rows.flocks; f++) {
    // Batched every ~41 days; the most recent batch is the one currently in the shed.
    var cycleAge = f === rows.flocks - 1 ? rint_(12, 26) : (rows.flocks - 1 - f) * 41;
    var placed = daysAgo_(cycleAge, 7);
    var birds = roundTo_(9000 + rnd_() * 6000, 500);
    var running = cycleAge < 38;
    var ageDays = running ? Math.min(38, cycleAge + rint_(0, 6)) : 38 + rint_(0, 4);
    var weight = Math.min(2.45, 0.045 * ageDays + rnd_() * 0.12);   // ~40–45 g/day
    var feedPerBird = weight * (1.52 + rnd_() * 0.26);               // FCR 1.5–1.8
    var feedKg = Math.round(birds * feedPerBird);
    var mortalityBirds = Math.round(birds * (0.022 + Math.pow(rnd_(), 1.5) * 0.045));
    var fcr = Math.round((feedKg / (birds * weight)) * 100) / 100;
    var batch = 'B-' + (1201 + f);
    batchIds.push({ id: batch, placed: placed, birds: birds, running: running, weight: weight });
    out.flocks.push([batch, placed, birds, feedKg, mortalityBirds, Math.round(weight * 100) / 100, fcr,
      running ? 'In Shed' : (rnd_() < 0.9 ? 'Lifted' : 'Culled')]);
  }

  var running2 = batchIds.filter(function (b) { return b.running; });
  if (!running2.length) running2 = batchIds.slice(-2);

  // daily shed log for the last 60 days on the current batch(es)
  for (var d = 150; d >= 0; d--) {
    var date = daysAgo_(d, 6);
    var b = running2[d % running2.length];
    var dayAge = Math.max(1, -daysBetween_(TODAY_, b.placed) - d);
    var feed = Math.round(b.birds * (0.028 * dayAge + 0.03) * (0.94 + rnd_() * 0.12));
    var deaths = Math.round(b.birds * (0.0012 + rnd_() * 0.0032) * (d < 6 ? 0.6 : 1));
    out.daily.push([date, b.id, feed, Math.round(feed * (1.7 + rnd_() * 0.4)),
      deaths, Math.round((30 + rnd_() * 6 + (d < 3 ? 1.5 : 0)) * 10) / 10]);
  }

  for (var s = 0; s < rows.sales; s++) {
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 11);
    var b2 = pick_(batchIds);
    var birdsSold = roundTo_(400 + rnd_() * 1600, 25);
    var kg = Math.round(birdsSold * (1.55 + rnd_() * 0.55));
    var rate = Math.round(330 + rnd_() * 190);                        // Rs 330–520 per kg live
    var amount = kg * rate;
    var status = rnd_() < 0.9 ? 'Paid' : pick_(['Credit', 'Partial']);
    out.sales.push([dt, b2.id, birdsSold, kg, rate, amount, pick_(buyers), status]);
  }
  return out;
}

/* ---------------------------------------------------------------- 21 · FUEL STATION --------- */
function genFuelStation_(rows) {
  var out = { shifts: [], shop: [], credit: [] };
  var products = [['Petrol', 62], ['Hi-Octane', 14], ['Diesel (HSD)', 24]];
  var rates = { 'Petrol': 381, 'Hi-Octane': 452, 'Diesel (HSD)': 396 };      // PKR per litre, late 2026
  var margins = { 'Petrol': 9.98, 'Hi-Octane': 11.4, 'Diesel (HSD)': 9.98 };  // dealer margin, government-set
  var shiftNames = ['Morning (6am–2pm)', 'Evening (2pm–10pm)', 'Night (10pm–6am)'];

  var days = Math.floor(rows.shifts / (shiftNames.length * products.length));
  for (var d = days; d >= 0; d--) {
    var date = daysAgo_(d, 8);
    var weekend = isWeekend_(date) ? 0.88 : 1;
    for (var s = 0; s < shiftNames.length; s++) {
      var shiftLoad = s === 2 ? 0.55 : (s === 1 ? 1.12 : 1);       // evening peak
      for (var p = 0; p < products.length; p++) {
        var prod = products[p][0];
        var baseLitres = prod === 'Petrol' ? 5200 : prod === 'Diesel (HSD)' ? 3100 : 900;
        var litres = Math.round(baseLitres * shiftLoad * weekend * (0.86 + rnd_() * 0.28) * season_(date, 'retail'));
        var rate = rates[prod] + (rnd_() < 0.12 ? rint_(2, 9) : 0);  // small price revisions
        out.shifts.push([date, shiftNames[s], prod, litres, rate, margins[prod],
          litres * rate, pick_(['Pump 1', 'Pump 2', 'Pump 3', 'Pump 4'])]);
      }
    }
  }

  var shopCats = ['Beverages', 'Snacks', 'Cigarettes', 'Engine Oil', 'Lubricants', 'Car Care',
    'Grocery', 'Ice Cream', 'Newspapers', 'Mobile Top-up'];
  for (var i = 0; i < rows.shop; i++) {
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 14);
    var cat = pick_(shopCats);
    var qty = rint_(20, 320);          // a forecourt shop moves volume, not single units
    var unit = cat === 'Engine Oil' ? rint_(1400, 4200) : cat === 'Cigarettes' ? rint_(180, 320) :
               cat === 'Lubricants' ? rint_(900, 2600) : cat === 'Mobile Top-up' ? rint_(100, 1000) :
               rint_(90, 620);
    var amount = qty * unit;
    out.shop.push([dt, cat, qty, amount, roundTo_(amount * (0.72 + rnd_() * 0.1), 10)]);
  }

  var fleetNames = ['Metro Bus Service', 'Rapid Transit Co', 'Skyways Courier', 'City School Transport',
    'Al-Noor Traders', 'Highway Dhaba', 'Gulberg Rent-a-Car', 'Sindh Police Fleet', 'Careem Fleet',
    'Careem Operations', 'Bykea Riders', 'Salman Transport'];
  for (var c = 0; c < rows.credit; c++) {
    var outstanding = roundTo_(25000 + Math.pow(rnd_(), 1.6) * 380000, 500);
    out.credit.push([pick_(fleetNames) + ' · ' + rint_(1, 9),
      daysAgo_(rint_(2, 180), 10), outstanding,
      pick_(['Toyota Hilux', 'Suzuki Bolan', 'Hino Truck', 'Fleet van', 'Honda CD-70']),
      pickW_([['Overdue', 46], ['Partial', 22], ['Current', 32]])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 22 · MSP ------------------ */
function genMsp_(rows) {
  var out = { tickets: [], contracts: [], invoices: [] };
  var issues = ['Password reset', 'Outlook sync', 'VPN access', 'Printer offline', 'Disk space',
    'Backup failure', 'Phishing report', 'Network slowness', 'New user setup', 'Server alert',
    'Application error', 'MFA device'];
  var priorities = [['P1', 6], ['P2', 22], ['P3', 46], ['P4', 26]];
  var engineers = ['Zain H.', 'Nimra S.', 'Faizan A.', 'Rabia M.', 'Talha R.', 'Bushra K.',
    'Ahsan J.', 'Kamran D.', 'Sadia I.', 'Owais N.', 'Hina P.', 'Arsalan Q.'];
  var tiers = ['Essential', 'Advanced', 'Premier'];

  var clientNames = [];
  for (var c = 0; c < rows.contracts; c++) {
    var seats = roundTo_(25 + Math.pow(rnd_(), 1.6) * 420, 5);
    var perSeat = 2600 + rnd_() * 2400;
    var tier = pick_(tiers);
    var renew = daysFromToday_(rint_(20, 420));
    var status = pickW_([['Active', 82], ['Renewal Due', 12], ['Churned', 6]]);
    var name = pCompany_();
    clientNames.push(name);
    out.contracts.push([name, seats, roundTo_(seats * perSeat, 500), tier, renew, status]);
  }

  for (var t = 0; t < rows.tickets; t++) {
    var opened = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 9);
    var pri = pickW_(priorities);
    var frtTarget = pri === 'P1' ? 15 : pri === 'P2' ? 20 : pri === 'P3' ? 30 : 45;   // minutes
    // First response is measured in minutes; the median sits well inside the target.
    var onTime = rnd_() < 0.93;
    var frt = Math.round(onTime ? (1 + Math.pow(rnd_(), 1.3) * (frtTarget * 0.6))
                                : frtTarget * (1.2 + rnd_() * 1.8));
    var resolvedFlag = rnd_() < (daysBetween_(opened, TODAY_) > 4 ? 0.93 : 0.55);
    var hours = Math.round((pri === 'P1' ? 2 + rnd_() * 5 : pri === 'P2' ? 5 + rnd_() * 14 :
      pri === 'P3' ? 8 + rnd_() * 28 : 12 + rnd_() * 50) * 10) / 10;
    var resolved = resolvedFlag ? new Date(opened.getTime() + hours * 3600000) : '';
    if (resolved && resolved > new Date()) resolved = '';
    var sla = frt <= frtTarget ? 'Met' : (resolved ? 'Breached' : 'At Risk');
    out.tickets.push([opened, pick_(clientNames), pri, pick_(issues), frt, resolved, hours,
      pick_(engineers), sla]);
  }

  for (var i = 0; i < rows.invoices; i++) {
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 10);
    var amount = roundTo_(120000 + Math.pow(rnd_(), 1.3) * 1900000, 500);
    var due = addDays_(dt, 15);
    var paid = rnd_() < (isPast_(due) ? 0.88 : 0.15) ? addDays_(dt, rint_(4, 22)) : '';
    var status = paid && paid <= TODAY_ ? 'Paid' : (isPast_(due) ? pickW_([['Overdue', 74], ['Partial', 26]]) : 'Pending');
    out.invoices.push([dt, pick_(clientNames), amount, due, paid, status]);
  }
  return out;
}

/* ---------------------------------------------------------------- 23 · AUTO WORKSHOP -------- */
function genAutoShop_(rows) {
  var out = { jobs: [], parts: [], expenses: [] };
  var vehicles = ['Toyota Corolla', 'Suzuki Cultus', 'Honda Civic', 'Toyota Yaris', 'Suzuki Alto',
    'Honda City', 'Kia Sportage', 'Toyota Fortuner', 'Suzuki Wagon R', 'Hyundai Tucson',
    'Toyota Hilux', 'Suzuki Every', 'MG HS', 'Honda BR-V'];
  var services = [['Periodic Service', 34], ['Brake Job', 14], ['AC Service', 16], ['Engine Repair', 10],
    ['Denting & Painting', 9], ['Tyres & Alignment', 9], ['Electrical', 8]];
  var techs = ['Rafiq (Master)', 'Shahid', 'Imran', 'Naveed', 'Adnan', 'Kamran', 'Sohail'];
  var partsCats = ['Engine', 'Brakes', 'Suspension', 'Electrical', 'Body', 'Filters', 'Oils & Fluids', 'Tyres'];

  for (var j = 0; j < rows.jobs; j++) {
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 11);
    var svc = pickW_(services);
    var labourBase = svc === 'Engine Repair' ? 32000 : svc === 'Denting & Painting' ? 46000 :
                     svc === 'Periodic Service' ? 8500 : svc === 'AC Service' ? 11000 : 13500;
    var labour = roundTo_(labourBase * (0.7 + rnd_() * 0.9), 500);
    var parts = roundTo_(labour * (0.5 + rnd_() * 1.6), 100);
    var total = labour + parts;
    var ageing2 = -daysBetween_(TODAY_, date);
    var status, delivered = '';
    if (ageing2 > 3) {
      status = rnd_() < 0.93 ? 'Delivered' : 'In Progress';
      if (status === 'Delivered') delivered = addDays_(date, rint_(1, 4));
    } else {
      status = pickW_([['In Progress', 42], ['Waiting Parts', 20], ['Ready', 18], ['Delivered', 20]]);
    }
    if (ageing2 > 20 && rnd_() < 0.06) status = 'Warranty Rework';

    out.jobs.push([date, 'JC-' + (48000 + j), 'ABC-' + rint_(100, 999), pick_(vehicles), svc,
      pick_(techs), labour, parts, total, status, delivered]);
  }

  var partNames = ['Oil Filter', 'Air Filter', 'Brake Pad Set', 'Shock Absorber', 'Clutch Plate',
    'Wiper Blade', 'Headlight Assembly', 'Side Mirror', 'Radiator Hose', 'Timing Belt',
    'Spark Plug', 'Battery 65Ah', 'Engine Oil 4L', 'Coolant 5L', 'Brake Fluid', 'Tyre 195/65',
    'Bumper Front', 'Fender Left', 'Alternator', 'Starter Motor'];
  for (var p = 0; p < rows.parts; p++) {
    var cost = roundTo_(400 + Math.pow(rnd_(), 1.7) * 62000, 50);
    var stock = Math.round(0 + Math.pow(rnd_(), 1.8) * 120);
    out.parts.push([partNames[p % partNames.length] + (p >= partNames.length ? ' — ' + pick_(['OEM', 'Local', 'Genuine']) : ''),
      pick_(partsCats), stock, cost, roundTo_(cost * (1.28 + rnd_() * 0.22), 50), rint_(5, 25)]);
  }

  var vendors = ['Toyota Pakistan', 'Honda Atlas', 'Pak Suzuki', 'Auto Parts Bazaar', 'Lucky Motors',
    'Shell Lubricants', 'Total Oil', 'K-Electric', 'Rent — Workshop'];
  for (var e = 0; e < rows.expenses; e++) {
    out.expenses.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12),
      pick_(['Rent', 'Utilities', 'Tools', 'Consumables', 'Marketing', 'Salaries — extra', 'Warranty Claims']),
      roundTo_(9000 + Math.pow(rnd_(), 1.6) * 260000, 500), pick_(vendors),
      pick_(['Monthly', 'Purchase', 'Repair', 'Campaign'])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 24 · PRINTING PRESS ------- */
function genPrinting_(rows) {
  var out = { jobs: [], machines: [], expenses: [] };
  var products = [['Wedding Cards', 20], ['Packaging Boxes', 24], ['Company Profiles', 14],
    ['Stickers & Labels', 15], ['Banners & Flex', 12], ['Books & Manuals', 9], ['Letterheads', 6]];
  var statuses = [['Delivered', 62], ['On Press', 12], ['Prepress', 10], ['Proof Sent', 8],
    ['Awaiting Approval', 5], ['Plate Making', 3]];

  var pressNames = ['Heidelberg SM 74', 'Heidelberg GTO 52', 'Ryobi 512', 'Komori Sprint',
    'Digital Konica C6085', 'Die-Cutting Unit'];
  for (var m = 0; m < pressNames.length; m++) {
    var capacity = m < 4 ? rint_(7000, 13000) : (m === 4 ? 4500 : 1800);
    var runH = rint_(180, 320);
    out.machines.push([pressNames[m], capacity, runH, rint_(6, 54),
      pickW_([['Running', 70], ['Idle', 18], ['Maintenance', 12]])]);
  }

  for (var j = 0; j < rows.jobs; j++) {
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12);
    var prod = pickW_(products);
    var qty = prod === 'Wedding Cards' ? rint_(300, 2500) : prod === 'Packaging Boxes' ? rint_(2000, 40000) :
              prod === 'Banners & Flex' ? rint_(10, 200) : rint_(200, 8000);
    var sheets = Math.round(qty * (prod === 'Packaging Boxes' ? 1.06 : 1.14));
    var wastePct = 0.014 + Math.pow(rnd_(), 1.8) * 0.05;   // 1.4–6%, clustered around 3%
    var waste = Math.round(sheets * wastePct);
    var plates = prod === 'Banners & Flex' ? 0 : rint_(2, 8);
    var unit = prod === 'Wedding Cards' ? 46 : prod === 'Packaging Boxes' ? 9 :
               prod === 'Banners & Flex' ? 640 : prod === 'Books & Manuals' ? 62 : 28;
    var amount = roundTo_(qty * unit * (0.85 + rnd_() * 0.4), 500);
    out.jobs.push([date, 'PR-' + (7100 + j), pCompany_(), prod, qty, sheets, waste, plates, amount,
      pickW_(statuses)]);
  }

  for (var e = 0; e < rows.expenses; e++) {
    out.expenses.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12),
      pick_(['Paper Stock', 'Ink & Chemicals', 'Plates', 'Rent', 'Utilities', 'Maintenance', 'Transport']),
      roundTo_(15000 + Math.pow(rnd_(), 1.5) * 420000, 500),
      pick_(['Century Paper', 'Packages Ltd', 'DIC Pakistan', 'Sakura Ink', 'K-Electric',
        'Heidelberg Service', 'Local Transport']),
      pick_(['Monthly', 'Restock', 'Repair', 'Delivery'])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 25 · TEXTILE / APPAREL ----- */
function genTextile_(rows) {
  var out = { lines: [], orders: [], defects: [] };
  var lineNames = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6'];
  var styles = ['Basic Tee', 'Polo Shirt', 'Denim Pant', 'Hoodie', 'Cargo Short', 'Leggings',
    'Track Suit', 'Kurta', 'Formal Shirt', 'Kids Set'];
  var buyers = ['H&M', 'Zara', 'Primark', 'C&A', 'Decathlon', 'Kmart', 'Target', 'Walmart',
    'Bonobos', 'Next UK'];
  var defectTypes = ['Open seam', 'Skip stitch', 'Oil stain', 'Measurement', 'Fabric defect',
    'Broken needle', 'Puckering', 'Missing label', 'Shade variation'];

  for (var d = Math.floor(rows.lines / lineNames.length); d >= 0; d--) {
    var date = daysAgo_(d, 10);
    var weekendFactor = isWeekend_(date) ? 0.32 : 1;         // Sunday skeleton crew, not a total stop
    for (var l = 0; l < lineNames.length; l++) {
      var target = roundTo_((900 + rnd_() * 620) * weekendFactor, 10);
      var eff = 0.72 + rnd_() * 0.26;                        // 72–98% of target
      if (rnd_() < 0.07) eff -= 0.12;                        // bad day
      var produced = Math.round(target * eff);
      var dhu = Math.round((1.8 + Math.pow(rnd_(), 1.6) * 6.2) * 10) / 10;   // ~4 per 100 units
      out.lines.push([date, lineNames[l], pick_(styles), target, produced, dhu,
        rint_(28, 42), Math.round(produced * (dhu / 100)), 9 + rint_(0, 2)]);
    }
  }

  for (var o = 0; o < rows.orders; o++) {
    var qty = roundTo_(3000 + Math.pow(rnd_(), 1.4) * 60000, 500);
    var fob = 380 + rnd_() * 1500;                            // Rs per piece
    var exf = daysFromToday_(rint_(-120, 75));
    var status = exf < TODAY_ ? pickW_([['Shipped', 90], ['Delayed', 6], ['In Production', 4]]) :
      pickW_([['In Production', 52], ['Cutting', 18], ['Sewing', 20], ['Shipped', 10]]);
    out.orders.push(['PO-' + (2600 + o), pick_(buyers), pick_(styles), qty,
      roundTo_(qty * fob, 1000), exf, status]);
  }

  for (var df = 0; df < rows.defects; df++) {
    out.defects.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 13), pick_(lineNames),
      pick_(defectTypes), rint_(2, 90), pick_(['QC table', 'End line', 'Final audit', 'Inline'])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 26 · BAKERY --------------- */
function genBakery_(rows) {
  var out = { production: [], orders: [], sales: [] };
  var catalogue = [
    ['Sourdough Loaf', 'Bread', 620], ['Multigrain Loaf', 'Bread', 700], ['Milk Bread', 'Bread', 380],
    ['Burger Bun', 'Bread', 90], ['Croissant', 'Viennoiserie', 1500], ['Pain au Chocolat', 'Viennoiserie', 1650],
    ['Danish Pastry', 'Viennoiserie', 1400], ['Chocolate Cake', 'Cakes', 2600], ['Red Velvet Cake', 'Cakes', 2800],
    ['Cheesecake', 'Cakes', 3100], ['Brownie', 'Cakes', 2200], ['Cupcake', 'Cakes', 1900],
    ['Chicken Patty', 'Savoury', 950], ['Pizza Slice', 'Savoury', 800], ['Quiche', 'Savoury', 2400],
    ['Cookies 250g', 'Biscuits', 1250], ['Nan Khatai', 'Biscuits', 1100], ['Rusk', 'Biscuits', 620],
  ];

  var days = Math.max(60, Math.round(rows.production / catalogue.length));
  for (var d = days; d >= 0; d--) {
    var date = daysAgo_(d, 16);
    var weekend = isWeekend_(date) ? 1.16 : 1;
    for (var p = 0; p < catalogue.length; p++) {
      var item = catalogue[p];
      var baseKg = item[1] === 'Bread' ? 26 : item[1] === 'Cakes' ? 11 : item[1] === 'Viennoiserie' ? 9 : 7;
      var baked = Math.round(baseKg * weekend * (0.75 + rnd_() * 0.5) * 10) / 10;
      var sellThrough = 0.88 + rnd_() * 0.12;
      if (isWeekend_(date)) sellThrough = Math.min(0.995, sellThrough + 0.05);
      var sold = Math.round(baked * sellThrough * 10) / 10;
      out.production.push([date, item[0], item[1], baked, sold, Math.round((baked - sold) * 10) / 10, item[2]]);
    }
  }

  var cakeItems = ['Chocolate Fudge Cake', 'Red Velvet Cake', 'Vanilla Birthday Cake', 'Cheesecake',
    'Tiered Wedding Cake', 'Cupcake Box (12)', 'Fresh Fruit Tart', 'Brownie Platter'];
  for (var o = 0; o < rows.orders; o++) {
    var dt = daysAgo_(rint_(0, 40), 13);
    var weight = pickW_([[1, 34], [1.5, 24], [2, 22], [3, 12], [4, 8]]);
    var item2 = pick_(cakeItems);
    var rate = item2 === 'Tiered Wedding Cake' ? 9500 : item2 === 'Cupcake Box (12)' ? 2400 : 2900;
    var delivery = daysFromToday_(rint_(-6, 12), 15);
    out.orders.push([dt, pName_(), item2, weight, Math.round(weight * rate * (0.9 + rnd_() * 0.3)),
      delivery, pickW_([['Delivered', 54], ['Confirmed', 26], ['Ready', 12], ['Cancelled', 8]])]);
  }

  var channels = [['Walk-in Counter', 54], ['Delivery App', 18], ['Wholesale / Cafés', 20], ['Corporate Orders', 8]];
  var salesDays = Math.max(60, rows.sales);
  for (var s = 0; s < salesDays; s++) {
    var dt2 = daysAgo_(s, 17);
    var weekend2 = isWeekend_(dt2) ? 1.2 : 1;
    for (var c = 0; c < channels.length; c++) {
      var base = channels[c][1] * 1000 * weekend2;
      var amount = roundTo_(base * (0.85 + rnd_() * 0.3), 100);
      out.sales.push([dt2, channels[c][0], amount, Math.max(3, Math.round(amount / (780 + rnd_() * 900)))]);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- 27 · COURIER --------------- */
function genCourier_(rows) {
  var out = { shipments: [], remittance: [], complaints: [] };
  var cities = [['Karachi', 30], ['Lahore', 26], ['Islamabad', 15], ['Rawalpindi', 8], ['Faisalabad', 7],
    ['Multan', 5], ['Peshawar', 4], ['Hyderabad', 3], ['Sialkot', 2]];
  var riders = ['Rider 101 — Imran', 'Rider 102 — Wasim', 'Rider 103 — Naveed', 'Rider 104 — Asif',
    'Rider 105 — Sajid', 'Rider 106 — Bilal', 'Rider 107 — Kamran', 'Rider 108 — Rashid'];
  var statuses = [['Delivered', 74], ['In Transit', 9], ['Out for Delivery', 6], ['At Hub', 5],
    ['Failed Attempt', 3], ['Returned', 3]];

  var awbList = [];
  for (var s = 0; s < rows.shipments; s++) {
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 18);
    var dest = pickW_(cities);
    var weight = Math.round((0.3 + Math.pow(rnd_(), 1.6) * 9) * 10) / 10;
    var cod = rnd_() < 0.62 ? roundTo_(1200 + Math.pow(rnd_(), 1.5) * 28000, 50) : 0;
    var charge = roundTo_(180 + weight * 75 + (dest === 'Karachi' ? 0 : 60), 10);
    var status = pickW_(statuses);
    var delivered = /Delivered/.test(status) ? addDays_(date, rnd_() < 0.92 ? rint_(1, 3) : rint_(4, 6)) : '';
    if (delivered && delivered > TODAY_) delivered = '';
    var awb = 'TCS' + (7000000 + s);
    awbList.push(awb);
    out.shipments.push([date, awb, 'Karachi', dest, weight, cod, charge, status, delivered, pick_(riders)]);
  }

  for (var r = 0; r < riders.length * 26; r++) {
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 20);
    var collected = roundTo_(30000 + rnd_() * 260000, 100);
    var shortfall = rnd_() < 0.18 ? roundTo_(collected * (0.02 + rnd_() * 0.12), 100) : 0;
    out.remittance.push([dt, riders[r % riders.length], collected, collected - shortfall,
      shortfall > 0 ? pick_(['Short', 'Partial']) : 'Settled']);
  }

  var types = ['Late delivery', 'Damaged parcel', 'Wrong address', 'COD dispute', 'Lost shipment',
    'Rude rider', 'Not attempted'];
  for (var c = 0; c < rows.complaints; c++) {
    out.complaints.push([daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 14), pick_(awbList), pick_(types),
      pickW_([['Closed', 62], ['Open', 24], ['Investigating', 14]]),
      pick_(['Resolved with customer', 'Refund issued', 'Awaiting shipper', 'Escalated'])]);
  }
  return out;
}

/* ---------------------------------------------------------------- 28 · ARCHITECTURE STUDIO -- */
function genArchFirm_(rows) {
  var out = { projects: [], timesheets: [], invoices: [] };
  var projectTypes = ['Residential Villa', 'Apartment Block', 'Corporate Office', 'Retail Outlet',
    'Hospital Wing', 'School Campus', 'Restaurant Interior', 'Mosque', 'Warehouse', 'Hotel Renovation'];
  var stages = [['Concept', 18], ['Schematic Design', 20], ['Design Development', 18],
    ['Construction Documents', 22], ['Tender', 10], ['Site Supervision', 12]];
  var architects = ['Sana Q.', 'Hassan M.', 'Ayesha R.', 'Bilal T.', 'Nida F.', 'Usman K.', 'Mariam A.', 'Zain S.'];
  var tasks = ['Design', 'Drafting', 'Site visit', 'Client meeting', 'Coordination', 'Admin'];

  var names = [];
  var areas = ['DHA Phase 6', 'Clifton', 'Bahria Town', 'Gulberg Lahore', 'F-7 Islamabad', 'PECHS'];
  for (var p = 0; p < rows.projects; p++) {
    var type = pick_(projectTypes);
    var area = type === 'Residential Villa' ? rint_(3000, 12000) :
               type === 'Apartment Block' ? rint_(40000, 180000) :
               type === 'Corporate Office' ? rint_(12000, 60000) : rint_(5000, 45000);
    var feeRate = type === 'Corporate Office' ? 380 : type === 'Residential Villa' ? 260 : 300;
    var start = daysAgo_(rint_(10, 900), 11);
    var stage = pickW_(stages);
    var status = rnd_() < 0.24 ? 'Completed' : (rnd_() < 0.14 ? 'On Hold' : 'Active');
    var name = pick_(areas) + ' ' + type + ' · ' + (2001 + p);
    names.push(name);
    out.projects.push([name, pCompany_(), stage, area, roundTo_(area * feeRate, 10000), start, status]);
  }

  for (var t = 0; t < rows.timesheets; t++) {
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 18);
    if (isWeekend_(date) && rnd_() < 0.78) date = addDays_(date, -2);
    var billable = rnd_() < 0.66 ? 'Yes' : 'No';
    out.timesheets.push([date, pick_(names), pick_(architects),
      Math.round((2 + Math.pow(rnd_(), 1.3) * 7) * 2) / 2, billable, pick_(tasks)]);
  }

  // Invoices are milestone bills against a real project fee (20–40% of the contract), never
  // a free-floating number — otherwise WIP and receivables stop meaning anything.
  var billed = {};
  var milestones = [['Concept', 0.20], ['Schematic Design', 0.25], ['Design Development', 0.25],
    ['Construction Documents', 0.20], ['Tender', 0.10]];
  for (var i = 0; i < rows.invoices; i++) {
    var proj = out.projects[rint_(0, out.projects.length - 1)];
    var ms = pick_(milestones);
    var billedSoFar = billed[proj[0]] || 0;
    var room = toNumber_(proj[4]) - billedSoFar;
    if (room < 50000) { continue; }                       // this project is fully billed
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 13);
    var amount = Math.min(room, roundTo_(toNumber_(proj[4]) * ms[1] * (0.9 + rnd_() * 0.2), 1000));
    billed[proj[0]] = billedSoFar + amount;
    var due = addDays_(dt, 30);
    var paid = rnd_() < (isPast_(due) ? 0.8 : 0.2) ? addDays_(dt, rint_(10, 60)) : '';
    var status = paid && paid <= TODAY_ ? 'Paid' : (isPast_(due) ? pickW_([['Overdue', 70], ['Partial', 30]]) : 'Pending');
    out.invoices.push([dt, proj[0], proj[1], amount, ms[0], due, paid, status]);
  }
  return out;
}

/* ---------------------------------------------------------------- 29 · VET CLINIC ------------ */
function genVetClinic_(rows) {
  var out = { visits: [], vaccinations: [], inventory: [] };
  var species = [['Dog', 46], ['Cat', 34], ['Bird', 10], ['Rabbit', 5], ['Goat', 3], ['Fish', 2]];
  var services = [['Consultation', 38], ['Vaccination', 20], ['Deworming', 10], ['Surgery', 6],
    ['Dental Scaling', 7], ['Grooming', 11], ['Lab Test', 8]];
  var vets = ['Dr. Fatima R.', 'Dr. Ali H.', 'Dr. Sana M.', 'Dr. Owais T.'];
  var petNames = ['Sheru', 'Simba', 'Tommy', 'Coco', 'Bruno', 'Moti', 'Bella', 'Max', 'Chotu',
    'Rocky', 'Luna', 'Kalu', 'Ruby', 'Daisy', 'Buddy', 'Tiger', 'Milo', 'Nemo'];
  var breeds = { Dog: ['Labrador', 'German Shepherd', 'Bulldog', 'Desi Kutta'], Cat: ['Persian', 'Siamese', 'Desi Billi'],
    Bird: ['Parrot', 'Lovebird', 'Pigeon'], Rabbit: ['Local'], Goat: ['Beetal'], Fish: ['Goldfish'] };

  var register = [];
  for (var v = 0; v < 900; v++) {
    var sp = pickW_(species);
    register.push({ pet: pick_(petNames) + ' (' + pick_(breeds[sp]) + ')', species: sp, owner: pName_() });
  }

  for (var i = 0; i < rows.visits; i++) {
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 17);
    if (isWeekend_(date) && rnd_() < 0.45) date = addDays_(date, 2);
    var pet = pick_(register);
    var svc = pickW_(services);
    var fee = svc === 'Surgery' ? rint_(18000, 65000) : svc === 'Dental Scaling' ? rint_(6000, 14000) :
              svc === 'Lab Test' ? rint_(2500, 9000) : svc === 'Grooming' ? rint_(2500, 7000) :
              svc === 'Vaccination' ? rint_(2500, 5500) : rint_(1500, 3500);
    out.visits.push([date, pet.pet, pet.species, pet.owner, svc, pick_(vets), fee,
      rnd_() < 0.9 ? 'Paid' : pick_(['Unpaid', 'Partial'])]);
  }

  var vaccines = { Dog: ['Anti-rabies', 'DHPP', 'Leptospirosis'], Cat: ['FVRCP', 'Anti-rabies'],
    Bird: ['Newcastle'], Rabbit: ['Myxomatosis'], Goat: ['PPR'], Fish: ['—'] };
  for (var c = 0; c < rows.vaccinations; c++) {
    var rec = pick_(register);
    var list = vaccines[rec.species] || ['General'];
    var given = daysAgo_(rint_(0, 400), 15);
    out.vaccinations.push([given, rec.pet, rec.species, pick_(list),
      addDays_(given, 365), rint_(2500, 5800)]);
  }

  var meds = ['Amoxicillin 250mg', 'Metronidazole', 'Ivermectin', 'Deworming Syrup', 'Rabies Vaccine',
    'Multivitamin Drops', 'Ear Drops', 'Eye Ointment', 'Pain Relief Syrup', 'Flea Spray',
    'Antibiotic Injection', 'Calcium Syrup', 'Skin Lotion', 'Bandage Roll'];
  var cats = ['Antibiotic', 'Vaccine', 'Dewormer', 'Supplement', 'Topical', 'Consumable'];
  for (var m = 0; m < rows.inventory; m++) {
    var cost = roundTo_(80 + Math.pow(rnd_(), 1.6) * 3800, 10);
    out.inventory.push([meds[m % meds.length] + (m >= meds.length ? ' — ' + pick_(['Vet', 'Pet', 'Plus']) : ''),
      pick_(cats), Math.round(Math.pow(rnd_(), 1.7) * 90), cost, roundTo_(cost * 1.45, 10),
      rnd_() < 0.1 ? daysFromToday_(rint_(10, 85)) : daysFromToday_(rint_(120, 900))]);
  }
  return out;
}

/* ---------------------------------------------------------------- 30 · SOLAR EPC ------------ */
function genSolar_(rows) {
  var out = { projects: [], payments: [], inventory: [] };
  var segments = [['Residential', 54], ['Commercial', 26], ['Industrial', 12], ['Agricultural', 8]];
  var nmStatus = [['Approved', 48], ['Pending', 26], ['Applied', 16], ['Not Required', 10]];
  var cities = [['Karachi', 34], ['Lahore', 26], ['Islamabad', 14], ['Faisalabad', 10],
    ['Multan', 8], ['Hyderabad', 4], ['Peshawar', 4]];
  var clients = [];
  var milestones = ['Booking Advance', 'Material Dispatch', 'Installation Complete', 'Net Metering'];
  var methods = ['Bank Transfer', 'Cheque', 'Online', 'Cash'];

  for (var p = 0; p < rows.projects; p++) {
    var seg = pickW_(segments);
    var kw = seg === 'Residential' ? roundTo_(5 + rnd_() * 10, 0.5) :
             seg === 'Commercial' ? roundTo_(20 + rnd_() * 60, 1) :
             seg === 'Industrial' ? roundTo_(100 + rnd_() * 400, 5) : roundTo_(15 + rnd_() * 35, 1);
    var costPerWatt = seg === 'Residential' ? 118 + rnd_() * 26 : seg === 'Commercial' ? 104 + rnd_() * 22 :
                      seg === 'Industrial' ? 94 + rnd_() * 18 : 108 + rnd_() * 20;
    var cost = roundTo_(kw * 1000 * costPerWatt, 1000);
    var date = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 12);
    var age = -daysBetween_(TODAY_, date);
    var status = age > 45 ? pickW_([['Commissioned', 86], ['Installation', 6], ['Cancelled', 8]]) :
      pickW_([['Site Survey', 24], ['Material Dispatch', 22], ['Installation', 34], ['Commissioned', 20]]);
    var nm = /Commissioned/.test(status) ? pickW_([['Approved', 82], ['Pending', 18]]) :
      pickW_([['Applied', 34], ['Pending', 46], ['Not Required', 20]]);
    var client = pCompany_();
    clients.push(client);
    out.projects.push([date, client, seg, kw, cost, pickW_(cities), nm, status]);
  }

  var paidPct = { 'Booking Advance': 0.30, 'Material Dispatch': 0.30, 'Installation Complete': 0.25,
    'Net Metering': 0.15 };
  for (var i = 0; i < rows.payments; i++) {
    var pj = out.projects[rint_(0, out.projects.length - 1)];
    var dt = daysAgo_(rint_(0, SEED_CONFIG.MONTHS * 30), 14);
    var ms2 = pick_(milestones);
    out.payments.push([dt, pj[1], roundTo_(pj[4] * paidPct[ms2] * (0.92 + rnd_() * 0.16), 1000),
      ms2, pick_(methods)]);
  }

  var items = [['Longi 580W Panel', 'Panels'], ['Jinko 550W Panel', 'Panels'], ['Canadian Solar 600W', 'Panels'],
    ['Huawei 8kW Inverter', 'Inverter'], ['Solis 10kW Inverter', 'Inverter'], ['Growatt 5kW Inverter', 'Inverter'],
    ['Galvanised Structure', 'Structure'], ['DC Cable 6mm', 'Cabling'], ['AC Cable 4mm', 'Cabling'],
    ['DC Breaker', 'Protection'], ['Surge Arrester', 'Protection'], ['Bi-directional Meter', 'Metering'],
    ['MC4 Connector', 'Cabling'], ['Earthing Kit', 'Protection']];
  for (var m = 0; m < rows.inventory; m++) {
    var it = items[m % items.length];
    var cost = it[1] === 'Panels' ? rint_(22000, 34000) : it[1] === 'Inverter' ? rint_(180000, 620000) :
               it[1] === 'Structure' ? rint_(14000, 26000) : rint_(900, 18000);
    out.inventory.push([it[0], it[1], Math.round(Math.pow(rnd_(), 1.6) * 160), cost, rint_(5, 40)]);
  }
  return out;
}

var SEED_GENERATORS = {
  agency: genAgency_,
  realestate: genRealEstate_,
  coaching: genCoaching_,
  ecommerce: genEcommerce_,
  restaurant: genRestaurant_,
  salon: genSalon_,
  gym: genGym_,
  school: genSchool_,
  clinic: genClinic_,
  travel: genTravel_,
  construction: genConstruction_,
  photography: genPhotography_,
  saas: genSaas_,
  logistics: genLogistics_,
  lawfirm: genLawFirm_,

  /* ---- v2 · industries 16–30 ---- */
  hotel: genHotel_,
  factory: genFactory_,
  recruitment: genRecruitment_,
  pharmacy: genPharmacy_,
  poultry: genPoultry_,
  fuelstation: genFuelStation_,
  msp: genMsp_,
  autoshop: genAutoShop_,
  printing: genPrinting_,
  textile: genTextile_,
  bakery: genBakery_,
  courier: genCourier_,
  archfirm: genArchFirm_,
  vetclinic: genVetClinic_,
  solar: genSolar_,
};


/* ================================================================================================
 *  6. WRITER  —  turns generated rows into real, formatted tabs
 * ============================================================================================== */

/**
 * Main entry point. Seeds the industries named in SEED_CONFIG.INDUSTRIES (or the argument).
 * @param {string|Array<string>} [slugs]  'all' | 'clinic' | ['clinic','gym']
 */
function seedDemoData(slugs) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create('Business Dashboard Suite');

  var targets = resolveIndustries_(slugs);
  if (!targets.length) {
    say_('No matching industries. Available: ' + demoIndustries().map(function (i) { return i.slug; }).join(', '));
    return { error: 'no industries' };
  }

  // ---- confirm before overwriting ----
  if (SEED_CONFIG.CONFIRM && hasExistingData_(ss, targets)) {
    var proceed = true;
    try {
      var ui = SpreadsheetApp.getUi();
      proceed = ui.alert('Overwrite demo data?',
        'These tabs will be cleared and refilled:\n\n' +
        targets.map(function (i) { return '• ' + i.name; }).join('\n') +
        '\n\nAnything typed in them is lost.', ui.ButtonSet.YES_NO) === ui.Button.YES;
    } catch (e) {
      proceed = false;
      SpreadsheetApp.getActive().toast('Skipped: existing data found. Set SEED_CONFIG.CONFIRM = false to force.', 'Seed', 6);
    }
    if (!proceed) return { cancelled: true };
  }

  var summary = [];
  var t0 = Date.now();

  targets.forEach(function (ind) {
    // reset the PRNG per industry → each industry is independently reproducible
    __seedState = (SEED_CONFIG.SEED + ind.slug.length * 977) >>> 0;

    var rowCfg = scaledRows_(ind.slug);
    var data = SEED_GENERATORS[ind.slug](rowCfg);
    var total = 0;

    ind.tabs.forEach(function (tab) {
      var rows = data[tab.key] || [];
      writeTab_(ss, ind, tab, rows);
      total += rows.length;
    });

    summary.push({ industry: ind.slug, name: ind.name, rows: total });
    try { SpreadsheetApp.getActive().toast(ind.name + ' — ' + total + ' rows', 'Seeding', 3); } catch (e) {}
  });

  if (SEED_CONFIG.DROP_DEFAULT_SHEET) dropDefaultSheet_(ss);

  var secs = ((Date.now() - t0) / 1000).toFixed(1);
  var lines = [
    'Demo data ready in ' + secs + 's',
    '',
  ].concat(summary.map(function (s) { return '• ' + s.name + ' — ' + s.rows + ' rows'; }));
  lines.push('');
  lines.push('Open 📊 Dashboard → Open dashboard to view it.');
  say_(lines.join('\n'));

  return { file: ss.getName(), url: ss.getUrl(), industries: summary };
}

/** Menu wrapper: asks which industry to seed. */
function promptSeedDemoData() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Seed demo data',
    'Type "all", or one/more industry slugs separated by commas:\n\n' +
    demoIndustries().map(function (i) { return '• ' + i.slug + ' — ' + i.name; }).join('\n'),
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  seedDemoData(res.getResponseText().trim() || 'all');
}

/** Clears every demo tab (keeps headers and formatting so you can type over it). */
function clearDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleared = 0;
  demoIndustries().forEach(function (ind) {
    ind.tabs.forEach(function (tab) {
      var sheet = ss.getSheetByName(demoSheetName(ind, tab));
      if (sheet && sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
        cleared++;
      }
    });
  });
  say_('Cleared data rows in ' + cleared + ' tabs (headings kept).');
  return cleared;
}

/* ---- helpers ---- */

function resolveIndustries_(slugs) {
  var wanted = slugs === undefined ? SEED_CONFIG.INDUSTRIES : slugs;
  var all = demoIndustries();
  if (!wanted || wanted === 'all') return all;
  if (typeof wanted === 'string') {
    wanted = wanted.split(',').map(function (s) { return s.trim().toLowerCase(); });
  }
  return all.filter(function (ind) { return wanted.indexOf(ind.slug) >= 0; });
}

function scaledRows_(slug) {
  var base = SEED_ROWS[slug] || {};
  var out = {};
  Object.keys(base).forEach(function (k) {
    out[k] = Math.max(6, Math.round(base[k] * SEED_CONFIG.SCALE));
  });
  return out;
}

function hasExistingData_(ss, targets) {
  for (var i = 0; i < targets.length; i++) {
    for (var j = 0; j < targets[i].tabs.length; j++) {
      var sheet = ss.getSheetByName(demoSheetName(targets[i], targets[i].tabs[j]));
      if (sheet && sheet.getLastRow() > 1) return true;
    }
  }
  return false;
}

/** Writes one tab: headers from Code.gs, rows from the generator, then formatting. */
function writeTab_(ss, ind, tab, rows) {
  var name = demoSheetName(ind, tab);
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (SEED_CONFIG.CLEAR_FIRST) {
    sheet.clear();
    var existing = sheet.getFilter();
    if (existing) existing.remove();
  }
  sheet.setTabColor(ind.accent);

  var headers = tab.cols.map(function (c) { return c.h; });

  // newest-first ordering keeps the sheet readable (the dashboard sorts anyway)
  var dateIdx = -1;
  for (var c = 0; c < tab.cols.length; c++) if (tab.cols[c].t === 'date') { dateIdx = c; break; }
  var sorted = rows.slice();
  if (dateIdx >= 0) {
    sorted.sort(function (a, b) {
      var av = a[dateIdx] instanceof Date ? a[dateIdx].getTime() : 0;
      var bv = b[dateIdx] instanceof Date ? b[dateIdx].getTime() : 0;
      return bv - av;
    });
  }

  var values = [headers].concat(sorted);
  var nRows = values.length;
  var nCols = headers.length;
  sheet.getRange(1, 1, nRows, nCols).setValues(values);

  if (!SEED_CONFIG.FORMAT) return sheet;

  // ---- header ----
  sheet.getRange(1, 1, 1, nCols)
    .setBackground(SEED_CONFIG.HEADER_BG)
    .setFontColor(SEED_CONFIG.HEADER_FG)
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sheet.setRowHeight(1, 34);

  // ---- column widths + number formats ----
  tab.cols.forEach(function (col, i) {
    var width = col.t === 'money' ? 125 : col.t === 'date' ? 112 : col.t === 'status' ? 120
              : col.t === 'badge' ? 165 : col.t === 'num' ? 95 : 200;
    sheet.setColumnWidth(i + 1, width);

    if (col.t === 'money') {
      sheet.getRange(2, i + 1, Math.max(1, nRows - 1), 1).setNumberFormat(SEED_CONFIG.CURRENCY_FORMAT);
    } else if (col.t === 'date') {
      sheet.getRange(2, i + 1, Math.max(1, nRows - 1), 1).setNumberFormat(SEED_CONFIG.DATE_FORMAT);
    }
  });

  // ---- banding, freeze, filter ----
  try {
    sheet.getRange(1, 1, nRows, nCols).applyRowBanding(
      SpreadsheetApp.BandingTheme[SEED_CONFIG.BANDING] || SpreadsheetApp.BandingTheme.LIGHT_GREY, true);
  } catch (e) {}
  sheet.setFrozenRows(1);
  if (nRows > 1) sheet.getRange(1, 1, nRows, nCols).createFilter();

  // ---- dropdowns + colour coding on status/badge columns ----
  tab.cols.forEach(function (col, i) {
    if (col.t !== 'status' && col.t !== 'badge') return;

    var seen = {};
    for (var r = 0; r < sorted.length; r++) {
      var v = String(sorted[r][i] === undefined || sorted[r][i] === null ? '' : sorted[r][i]).trim();
      if (v) seen[v] = true;
    }
    var options = Object.keys(seen).slice(0, 40);
    if (!options.length) return;

    var range = sheet.getRange(2, i + 1, Math.max(200, nRows), 1);

    try {
      range.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(options, true).setAllowInvalid(false).build());
    } catch (e) {}

    // colour by keyword so the sheet is readable without the dashboard
    var rules = [];
    options.forEach(function (opt) {
      var t = opt.toLowerCase(), bg = null, fg = null;
      if (/(paid|received|cleared|won|active|completed|complete|delivered|confirmed|closed|enrolled|open)/.test(t)) { bg = '#dcfce7'; fg = '#0f7a4f'; }
      else if (/(overdue|late|blocked|lost|cancel|churn|no show|exception|returned|left|dropped|delayed)/.test(t)) { bg = '#fee2e2'; fg = '#a4173b'; }
      else if (/(pending|due|partial|hold|progress|editing|scheduled|tentative|awaiting|deposit|in transit|unpaid|expired|frozen)/.test(t)) { bg = '#fef3c7'; fg = '#8a5a00'; }
      if (!bg) return;
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(opt).setBackground(bg).setFontColor(fg).setRanges([range]).build());
    });
    if (rules.length) {
      try { sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat(rules)); } catch (e) {}
    }
  });

  return sheet;
}

/** Removes an empty default "Sheet1" so the file opens on real data. */
function dropDefaultSheet_(ss) {
  var sheets = ss.getSheets();
  if (sheets.length <= 1) return;
  sheets.forEach(function (sheet) {
    if (/^(sheet\s?1|sheet)$/i.test(sheet.getName()) && sheet.getLastRow() === 0) {
      try { ss.deleteSheet(sheet); } catch (e) {}
    }
  });
}

/** Alert when there is a UI, otherwise log (editor runs). */
function say_(message) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (message.length > 1200) ui.alert(message);
    else ui.alert('Demo data', message, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log(message);
  }
}


/* ================================================================================================
 *  7. ONE-TIME PROJECT SETUP (optional convenience)
 *  Creates the Apps Script project files you still need to paste manually, then tells you what's
 *  left to do. Handy when you are starting from an empty spreadsheet.
 * ============================================================================================== */
function setupThisProject() {
  say_('Paste Code.gs, SeedData.gs and Index.html into this project, then run\n' +
       '📊 Dashboard → Seed demo data…\n\n' +
       'Industries available:\n' +
       demoIndustries().map(function (i) { return '• ' + i.slug + ' — ' + i.name; }).join('\n'));
}
