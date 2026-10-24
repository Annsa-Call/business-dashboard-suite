/**************************************************************************************************
 *  BUSINESS DASHBOARD SUITE  ·  Code.gs
 *  ------------------------------------------------------------------------------------------------
 *  ONE Apps Script backend, FIFTEEN industries. Each industry declares:
 *
 *      · which tabs to read        (tabs: [...])            → served by SeedData.gs
 *      · how to read the headings  (loose alias matching)   → you never have to rename columns
 *      · what to show on screen    (dashboard: fn)          → 6 KPI cards, 3 charts, 1 table
 *
 *  The dashboard HTML is generic: it renders whatever kpis/charts/table this file returns, so
 *  "which metrics matter" lives here, in plain readable JavaScript — not buried in the markup.
 *
 *  ------------------------------------------------------------------------------------------------
 *  FILES IN THIS PROJECT
 *      Code.gs      ← this file. Engine + the 15 industry definitions.
 *      SeedData.gs    Demo-data builder. Run seedDemoData() once to fill a spreadsheet.
 *      Index.html     The dashboard UI (self-contained: no CDN, no libraries).
 *
 *  QUICK START
 *      1. Extensions → Apps Script. Paste Code.gs into Code.gs, add SeedData.gs as a new script,
 *         add an HTML file named exactly  Index  and paste Index.html.
 *      2. Reload the sheet → 📊 Dashboard → "Seed demo data"  (choose an industry or all).
 *      3. 📊 Dashboard → "Open dashboard" (or Deploy → Web app and open the /exec URL).
 *
 *  WHICH INDUSTRY SHOWS?
 *      · In the sheet dialog: the industry you pick in the dashboard's own switcher.
 *      · On the web app:      ?demo=clinic  →  or SETTINGS.DEFAULT_DEMO.
 *      · For a real client:   set SETTINGS.DEFAULT_DEMO to their industry and delete the rest.
 *
 *  Everything you are likely to change is in SETTINGS (§1) and the industry list (§6+).
 **************************************************************************************************/


/* ================================================================================================
 *  1. SETTINGS
 * ============================================================================================== */
const SETTINGS = {
  SHEET_ID: '',                    // '' = the spreadsheet this script is bound to
  CURRENCY: 'PKR',                 // PKR · USD · EUR · GBP · INR · AED …
  LOCALE: 'en-PK',
  DEFAULT_DEMO: 'agency',          // which industry the web app opens on
  TAB_PREFIX: true,                // true  → tabs are named "Agency · Invoices" (all 15 fit in one sheet)
                                   // false → plain tab names ("Invoices") for a single-client install
  RECENT_ROWS: 8,                  // rows in the "recent records" table
  MONTHS_SHOWN: 12,                // months shown in trend charts
  FOLLOW_UP_DAYS: 7,               // agency follow-up window
  CACHE_SECONDS: 0,                // >0 caches each industry's payload (set 120 on big sheets)
  SHOW_SWITCHER: true,             // false hides the industry switcher (client-facing installs)
  COMPANY_NAME: '',                // client name shown in the header ('' = just the industry name)
};

const CURRENCY_SYMBOLS = {
  PKR: 'Rs', USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED',
  SAR: 'SAR', CAD: 'C$', AUD: 'A$', BDT: '৳', MYR: 'RM', SGD: 'S$',
};

/** Separator used when TAB_PREFIX is on:  "Agency · Invoices" */
const TAB_SEP = ' · ';


/* ================================================================================================
 *  2. SMALL UTILITIES  (server-side; the browser has its own copies)
 * ============================================================================================== */

/** Lower-case, collapse spaces, strip trailing "*" / ":" so headings match loosely. */
function norm_(v) {
  return String(v === null || v === undefined ? '' : v)
    .toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[*:]+$/g, '').trim();
}

function matchesAny_(text, words) {
  for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) >= 0) return true;
  return false;
}

/** Numbers from 125000 · "Rs 1,25,000" · "1.2M" · "" (blank → 0). */
function toNumber_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  var s = String(v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** Dates from real Date cells, Sheets serial numbers, ISO text and dd/mm/yyyy text. */
function toDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    var d0 = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d0.getTime()) ? null : d0;
  }
  var s = String(v).trim();
  if (!s) return null;
  var iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    var y = Number(dmy[3]); if (y < 100) y += 2000;
    return new Date(y, Number(dmy[2]) - 1, Number(dmy[1]));
  }
  var parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay_(d) { var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); return x; }
function addDays_(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function daysBetween_(a, b) { return Math.round((startOfDay_(b) - startOfDay_(a)) / 86400000); }
function sameMonth_(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function inLastDays_(d, days) { return !!d && daysBetween_(d, new Date()) <= days && daysBetween_(d, new Date()) >= 0; }
function scriptTZ_() { try { return Session.getScriptTimeZone() || 'UTC'; } catch (e) { return 'UTC'; } }
function money_(n) {
  var sym = CURRENCY_SYMBOLS[SETTINGS.CURRENCY] || SETTINGS.CURRENCY;
  var abs = Math.abs(n || 0);
  var text;
  if (abs >= 1e9) text = (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  else if (abs >= 1e6) text = (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  else if (abs >= 1e3) text = (n / 1e3).toFixed(0) + 'K';
  else text = String(Math.round(n || 0));
  return sym + ' ' + text;
}
function num_(n, dp) {
  var v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
}
function pct_(a, b, dp) { return (b ? (a / b) * 100 : 0).toFixed(dp === undefined ? 1 : dp) + '%'; }


/* ================================================================================================
 *  3. READING A SHEET
 * ------------------------------------------------------------------------------------------------
 *  A column definition is deliberately terse:
 *      { k:'amount', h:'Amount', a:['total','value'], t:'money' }
 *        k = key used in code          h = heading written by the seeder
 *        a = extra accepted headings   t = text | money | num | date | status | badge
 * ============================================================================================== */

/** Physical tab name for an industry + tab definition. */
function tabName_(ind, tab) {
  return SETTINGS.TAB_PREFIX && ind.short ? ind.short + TAB_SEP + tab.sheet : tab.sheet;
}

/**
 * Reads every tab of one industry.
 * @return {{tables:Object, notices:Array<string>}}
 */
function loadIndustry_(ind) {
  var ss = getSpreadsheet_();
  var out = { tables: {}, notices: [] };

  ind.tabs.forEach(function (tab) {
    var name = tabName_(ind, tab);
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      out.notices.push('Tab "' + name + '" not found — its numbers show as zero. Run "Seed demo data" to create it.');
      out.tables[tab.key] = [];
      return;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) { out.tables[tab.key] = []; return; }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values.shift().map(norm_);

    // Where is each logical column?
    var pos = {};
    tab.cols.forEach(function (col) {
      pos[col.k] = findHeader_(headers, col);
    });

    var rows = [];
    for (var r = 0; r < values.length; r++) {
      var raw = values[r];
      if (raw.join('').trim() === '') continue;

      var row = {};
      var hasContent = false;
      tab.cols.forEach(function (col) {
        var cell = pos[col.k] >= 0 ? raw[pos[col.k]] : '';
        var val;
        if (col.t === 'money' || col.t === 'num') val = toNumber_(cell);
        else if (col.t === 'date') val = toDate_(cell);
        else val = cell === null || cell === undefined ? '' : String(cell).trim();

        if (val !== '' && val !== null) hasContent = true;
        row[col.k] = val;
      });
      // Keep the raw row number so tables can be sorted "newest inserted" when no date exists.
      row.__row = r + 2;
      if (hasContent) rows.push(row);
    }

    out.tables[tab.key] = rows;
  });

  return out;
}

/** Finds a column index by heading, then aliases, then a prefix match. */
function findHeader_(headers, col) {
  var candidates = [col.h].concat(col.a || []).map(norm_);
  for (var i = 0; i < candidates.length; i++) {
    var at = headers.indexOf(candidates[i]);
    if (at >= 0) return at;
  }
  for (var c = 0; c < candidates.length; c++) {
    if (candidates[c].length < 4) continue;
    for (var h = 0; h < headers.length; h++) {
      if (headers[h].indexOf(candidates[c]) === 0) return h;
    }
  }
  return -1;
}

function getSpreadsheet_() {
  if (SETTINGS.SHEET_ID) return SpreadsheetApp.openById(SETTINGS.SHEET_ID);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No spreadsheet bound. Set SETTINGS.SHEET_ID in Code.gs.');
  return active;
}


/* ================================================================================================
 *  4. METRIC HELPERS  (used by every industry below)
 * ============================================================================================== */

function sumF(rows, field) {
  var t = 0;
  for (var i = 0; i < rows.length; i++) t += toNumber_(rows[i][field]);
  return t;
}
function sumWhere(rows, field, pred) {
  var t = 0;
  for (var i = 0; i < rows.length; i++) if (!pred || pred(rows[i])) t += toNumber_(rows[i][field]);
  return t;
}
function countWhere(rows, pred) {
  var n = 0;
  for (var i = 0; i < rows.length; i++) if (!pred || pred(rows[i])) n++;
  return n;
}
function avgF(rows, field, pred) {
  var n = 0, t = 0;
  for (var i = 0; i < rows.length; i++) {
    if (pred && !pred(rows[i])) continue;
    t += toNumber_(rows[i][field]); n++;
  }
  return n ? t / n : 0;
}
function medianF(rows, field) {
  var arr = rows.map(function (r) { return toNumber_(r[field]); }).sort(function (a, b) { return a - b; });
  if (!arr.length) return 0;
  var mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function ratio(a, b) { return b ? a / b : 0; }

/** Monthly series: last `months` months, ascending, with empty months as 0. */
function monthly(rows, dateField, valueField, months, pred) {
  months = months || SETTINGS.MONTHS_SHOWN;
  var tz = scriptTZ_();
  var now = new Date();
  var keys = [], labels = [], values = [];

  for (var i = months - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(Utilities.formatDate(d, tz, 'yyyy-MM'));
    labels.push(Utilities.formatDate(d, tz, 'MMM'));
    values.push(0);
  }

  rows.forEach(function (r) {
    if (pred && !pred(r)) return;
    var d = r[dateField];
    if (!d) return;
    var at = keys.indexOf(Utilities.formatDate(d, tz, 'yyyy-MM'));
    if (at < 0) return;
    values[at] += valueField ? toNumber_(r[valueField]) : 1;
  });

  return { labels: labels, values: values };
}

/** Group rows by a label field and sum (or count) — returns [{label, value}] sorted desc. */
function byKey(rows, keyField, valueField, limit) {
  var map = {};
  rows.forEach(function (r) {
    var raw = String(r[keyField] === null || r[keyField] === undefined ? '' : r[keyField]).trim();
    if (!raw) raw = 'Unspecified';
    map[raw] = (map[raw] || 0) + (valueField ? toNumber_(r[valueField]) : 1);
  });
  var list = Object.keys(map).map(function (k) { return { label: prettify_(k), value: map[k] }; });
  list.sort(function (a, b) { return b.value - a.value; });
  if (limit && list.length > limit) {
    var head = list.slice(0, limit - 1);
    var rest = list.slice(limit - 1).reduce(function (s, x) { return s + x.value; }, 0);
    head.push({ label: 'Other', value: rest });
    list = head;
  }
  return list;
}

/**
 * Keeps the given order, unknown labels appended (used for pipeline stages).
 * @param {Array<string>} [exclude]  labels to leave out entirely (e.g. ['Lost'])
 */
function byKeyOrdered(rows, keyField, valueField, order, exclude) {
  var drop = (exclude || []).map(function (x) { return x.toLowerCase(); });
  var list = byKey(rows, keyField, valueField).filter(function (x) {
    return drop.indexOf(x.label.toLowerCase()) < 0;
  });
  var map = {};
  list.forEach(function (x) { map[x.label.toLowerCase()] = x.value; });
  var lowerOrder = order.map(function (o) { return o.toLowerCase(); });
  var out = order.map(function (label) { return { label: label, value: map[label.toLowerCase()] || 0 }; });
  list.forEach(function (x) {
    if (lowerOrder.indexOf(x.label.toLowerCase()) < 0) out.push(x);
  });
  return out.filter(function (x) { return x.value > 0; });
}

/** "in progress" → "In Progress", "NEW" → "New" for chart legends and table chips. */
function prettify_(s) {
  var t = String(s || '').trim();
  if (!t) return '';
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** AR ageing buckets — used by clinic, law firm, construction. */
function ageing(rows, dueField, amountField) {
  var buckets = [
    { label: 'Current', value: 0 },
    { label: '1–30 days', value: 0 },
    { label: '31–60 days', value: 0 },
    { label: '61–90 days', value: 0 },
    { label: '90+ days', value: 0 },
  ];
  var today = startOfDay_(new Date());

  rows.forEach(function (r) {
    var due = r[dueField];
    var amt = toNumber_(r[amountField]);
    if (!due || !amt) return;
    var age = daysBetween_(due, today);
    if (age <= 0) buckets[0].value += amt;
    else if (age <= 30) buckets[1].value += amt;
    else if (age <= 60) buckets[2].value += amt;
    else if (age <= 90) buckets[3].value += amt;
    else buckets[4].value += amt;
  });

  return buckets.filter(function (b) { return b.value > 0; });
}

/** Sort newest-first and keep the first N. */
function newest(rows, dateField, n) {
  var copy = rows.slice().sort(function (a, b) {
    var av = a[dateField] ? a[dateField].getTime() : 0;
    var bv = b[dateField] ? b[dateField].getTime() : 0;
    if (av === bv) return (b.__row || 0) - (a.__row || 0);
    return bv - av;
  });
  return copy.slice(0, n || SETTINGS.RECENT_ROWS);
}


/* ================================================================================================
 *  5. PAYLOAD BUILDERS  (this is the shape Index.html consumes)
 * ============================================================================================== */

/**
 * KPI card.
 * @param {string} label
 * @param {number} value          money → PKR amount · percent → fraction (0.94) · number/day/hour
 * @param {Object} o              {format, icon, tone, caption, caption2, spark, progress,
 *                                 progressLabel, split, breakdown, alert}
 */
function KPI(label, value, o) {
  o = o || {};
  return {
    label: label,
    value: value,
    format: o.format || 'number',      // money | number | percent | days | hours
    icon: o.icon || 'info',
    tone: o.tone || 'brand',           // brand | ok | warn | danger | info
    caption: o.caption || '',
    caption2: o.caption2 || '',
    spark: o.spark || null,
    progress: typeof o.progress === 'number' ? o.progress : null,
    progressLabel: o.progressLabel || '',
    split: o.split || null,
    breakdown: o.breakdown || null,
    items: o.items || null,          // e.g. the next three follow-ups
    unit: o.unit || '',              // free-form suffix shown small after the number: Rs/L, kg, pcs, kWh, min
    dp: typeof o.dp === 'number' ? o.dp : null,
    alert: !!o.alert,
  };
}

/**
 * Chart.
 * @param {string} type   line | bars | donut | hbars
 */
function CHART(type, title, subtitle, labels, values, o) {
  o = o || {};
  return {
    type: type,
    title: title,
    subtitle: subtitle || '',
    labels: labels || [],
    values: values || [],
    format: o.format || 'money',
    note: o.note || '',
    total: o.total === undefined ? (values || []).reduce(function (a, b) { return a + b; }, 0) : o.total,
  };
}

/** Turn a byKey list into two arrays for a chart. */
function split_(list) {
  return {
    labels: list.map(function (x) { return x.label; }),
    values: list.map(function (x) { return x.value; }),
  };
}

/**
 * Recent-records table definition.
 * @param {Object} [o]  { withinDays: 120, futureDays: 0 }  → only rows dated inside that window count as "recent",
 *                      which keeps a table of invoices from filling up with next month's due dates.
 */
function TABLE(title, subtitle, rows, dateField, columns, o) {
  o = o || {};
  var pool = rows;
  if (o.withinDays) {
    var back = addDays_(new Date(), -o.withinDays).getTime();
    var ahead = addDays_(new Date(), o.futureDays === undefined ? 7 : o.futureDays).getTime();
    pool = rows.filter(function (r) {
      var d = r[dateField];
      return d && d.getTime() >= back && d.getTime() <= ahead;
    });
    // Nothing landed in the window (e.g. a business with no recent activity) → show the raw newest.
    if (pool.length < Math.min(4, SETTINGS.RECENT_ROWS)) pool = rows;
  }

  var picked = newest(pool, dateField, SETTINGS.RECENT_ROWS).map(function (r) {
    var o = {};
    columns.forEach(function (c) {
      var v = r[c.key];
      o[c.key] = v instanceof Date ? v.toISOString() : (v === undefined || v === null ? '' : v);
    });
    return o;
  });
  return { title: title, subtitle: subtitle || '', columns: columns, rows: picked };
}

/* ================================================================================================
 *  5b. A FEW MORE SERIES HELPERS  (daily trend, weekday split, rate trend)
 * ============================================================================================== */

/** Last `days` days, one point per day. Used for restaurant daily sales. */
function dailySeries(rows, dateField, valueField, days, pred) {
  var labels = [], values = [], keys = [];
  var today = startOfDay_(new Date());

  for (var i = days - 1; i >= 0; i--) {
    var d = addDays_(today, -i);
    keys.push(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate());
    labels.push(d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]);
    values.push(0);
  }

  rows.forEach(function (r) {
    if (pred && !pred(r)) return;
    var d = r[dateField];
    if (!d) return;
    var k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var at = keys.indexOf(k);
    if (at < 0) return;
    values[at] += valueField ? toNumber_(r[valueField]) : 1;   // no value field → count the rows
  });

  return { labels: labels, values: values };
}

/** Attendance / visits grouped by weekday, Monday → Sunday. */
function byWeekday(rows, dateField, valueField) {
  var names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var totals = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach(function (r) {
    var d = r[dateField];
    if (!d) return;
    var idx = (d.getDay() + 6) % 7;             // JS 0=Sun → 0=Mon
    totals[idx] += valueField ? toNumber_(r[valueField]) : 1;
  });
  return { labels: names, values: totals };
}

/** Monthly rate (0–100) series, e.g. on-time % or attendance %. */
function monthlyRate(rows, dateField, pred, months) {
  months = months || SETTINGS.MONTHS_SHOWN;
  var tz = scriptTZ_(), now = new Date();
  var keys = [], labels = [], hits = [], totals = [];

  for (var i = months - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(Utilities.formatDate(d, tz, 'yyyy-MM'));
    labels.push(Utilities.formatDate(d, tz, 'MMM'));
    hits.push(0); totals.push(0);
  }

  rows.forEach(function (r) {
    var d = r[dateField];
    if (!d) return;
    var at = keys.indexOf(Utilities.formatDate(d, tz, 'yyyy-MM'));
    if (at < 0) return;
    totals[at]++;
    if (!pred || pred(r)) hits[at]++;
  });

  var values = totals.map(function (t, i) { return t ? Math.round((hits[i] / t) * 1000) / 10 : 0; });
  return { labels: labels, values: values };
}

/* status helpers used all over the industries below */
function isPaid_(s) { return /paid|received|cleared|settled|deposit\s*paid/i.test(String(s || '')); }
function isOpenInvoice_(r) { return !isPaid_(r.status) && toNumber_(r.amount) > 0; }
function isPast_(d) { return !!d && d.getTime() < startOfDay_(new Date()).getTime(); }
function isFuture_(d) { return !!d && d.getTime() >= startOfDay_(new Date()).getTime(); }


/* ================================================================================================
 *  6. THE INDUSTRIES
 * ------------------------------------------------------------------------------------------------
 *  Order matters: it is the order of the switcher and of the portfolio.
 *  Each entry is self-contained — copy one block to start a new industry.
 * ============================================================================================== */
function C(k, h, t, a) { return { k: k, h: h, t: t || 'text', a: a || [] }; }

const INDUSTRIES = [

/* ------------------------------------------------------------------------------------------------
 *  01 · DIGITAL MARKETING AGENCY
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'agency', name: 'Digital Marketing Agency', short: 'Agency',
  icon: 'target', accent: '#6366f1',
  layout: { preset: 'grid' },
  tagline: 'Pipeline, retainers and cash collection for a growth agency',
  pitch: 'Retainer agencies live on three numbers: signed recurring revenue, cash actually collected, ' +
         'and whether the pipeline behind it is real. This puts all three on one screen so the team ' +
         'stops arguing about impressions and starts chasing invoices.',
  tabs: [
    { key: 'leads', sheet: 'Leads', cols: [
      C('date', 'Date', 'date', ['created', 'timestamp']),
      C('name', 'Lead Name', 'text', ['name', 'contact']),
      C('company', 'Company'),
      C('source', 'Source', 'badge', ['channel']),
      C('status', 'Status', 'status', ['stage']),
      C('owner', 'Owner', 'text', ['assigned to', 'rep']),
      C('value', 'Est. Value', 'money', ['deal value', 'budget']),
      C('followUp', 'Follow Up', 'date', ['next follow up', 'next action'])
    ]},
    { key: 'clients', sheet: 'Clients', cols: [
      C('name', 'Client Name', 'text', ['client', 'company']),
      C('service', 'Service', 'badge', ['package', 'plan']),
      C('mrr', 'Monthly Value', 'money', ['mrr', 'retainer']),
      C('status', 'Status', 'status'),
      C('start', 'Start Date', 'date', ['since', 'onboarded']),
      C('owner', 'Account Manager', 'text', ['owner', 'manager'])
    ]},
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('invoice', 'Invoice', 'text', ['invoice no', 'ref']),
      C('client', 'Client', 'text', ['customer']),
      C('amount', 'Amount', 'money', ['total', 'value']),
      C('due', 'Due Date', 'date', ['invoice date']),
      C('paid', 'Paid On', 'date', ['payment date', 'received on']),
      C('status', 'Status', 'status'),
      C('method', 'Method', 'badge', ['payment method', 'mode'])
    ]},
  ],
  dashboard: function (T) {
    var leads = T.leads, clients = T.clients, inv = T.invoices;
    var now = new Date();

    var openStages = ['New', 'Contacted', 'Qualified', 'Proposal'];   // everything else is closed
    var isOpenLead = function (l) { return openStages.indexOf(prettify_(l.status)) >= 0; };
    var pipeline = sumWhere(leads, 'value', isOpenLead);

    var active = clients.filter(function (c) {
      return !/inactive|churn|lost|cancel/i.test(c.status) &&
             (/active|retainer|current|live|signed/i.test(c.status) || !c.status);
    });
    var mrr = sumF(active, 'mrr');
    var collectedMonth = sumWhere(inv, 'amount', function (i) { return isPaid_(i.status) && sameMonth_(i.paid, now); });

    var openInv = inv.filter(isOpenInvoice_);
    var overdue = openInv.filter(function (i) { return isPast_(i.due); });
    var overdueAmt = sumF(overdue, 'amount');

    var followUps = leads.filter(function (l) {
      var d = l.followUp ? daysBetween_(now, l.followUp) : -1;
      return d >= 0 && d <= SETTINGS.FOLLOW_UP_DAYS;
    });
    var won = countWhere(leads, function (l) { return /won|signed|closed won/i.test(l.status); });
    var lost = countWhere(leads, function (l) { return /lost|declin/i.test(l.status); });

    var revenue = monthly(inv, 'paid', 'amount', 12, function (i) { return isPaid_(i.status); });
    var sources = byKey(leads, 'source', null, 6);
    var stages = byKeyOrdered(leads, 'status', 'value', ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'], ['Lost']);

    return {
      kpis: [
        KPI('Pipeline Value', pipeline, {
          format: 'money', icon: 'target', tone: 'brand',
          caption: countWhere(leads, isOpenLead) + ' open opportunities',
          caption2: 'Won ' + won + ' · Lost ' + lost + ' (' + pct_(won, won + lost, 0) + ' win rate)',
        }),
        KPI('Active Retainers', active.length, {
          format: 'number', icon: 'briefcase', tone: 'info',
          caption: 'of ' + clients.length + ' clients on file',
          progress: ratio(active.length, clients.length),
          progressLabel: pct_(active.length, clients.length, 0) + ' of the book is live',
        }),
        KPI('Monthly Recurring', mrr, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: 'Avg ' + money_(ratio(mrr, active.length)) + ' per retainer',
          spark: revenue.values,
        }),
        KPI('Collected This Month', collectedMonth, {
          format: 'money', icon: 'check', tone: 'ok',
          caption: 'Last 12 months: ' + money_(revenue.values.reduce(function (a, b) { return a + b; }, 0)),
        }),
        KPI('Overdue Receivables', overdueAmt, {
          format: 'money', icon: 'clock', tone: overdueAmt > 0 ? 'danger' : 'ok',
          caption: overdue.length + ' invoices past due of ' + openInv.length + ' open',
          alert: overdue.length > 0,
        }),
        KPI('Follow-ups Due', followUps.length, {
          format: 'number', icon: 'calendar', tone: 'brand',
          caption: 'Next ' + SETTINGS.FOLLOW_UP_DAYS + ' days',
          items: newest(followUps, 'followUp', 3).map(function (l) {
            return { name: l.name || l.company, when: l.followUp.toISOString(), meta: l.owner };
          }),
        }),
      ],
      charts: [
        CHART('line', 'Collected revenue', 'Cash in, last 12 months', revenue.labels, revenue.values),
        CHART('donut', 'Lead sources', 'Where enquiries come from', split_(sources).labels, split_(sources).values, { format: 'number' }),
        CHART('hbars', 'Pipeline by stage', 'Open value per stage', split_(stages).labels, split_(stages).values),
      ],
      table: TABLE('Recent invoices', 'Newest invoices by due date', inv, 'due', [
        { key: 'invoice', label: 'Invoice', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'paid', label: 'Paid', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 120, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  02 · REAL ESTATE (KARACHI)
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'realestate', name: 'Real Estate · Karachi', short: 'Realty',
  icon: 'home', accent: '#0ea5e9',
  layout: { preset: 'board' },
  tagline: 'Listings, enquiries and commissions across a Karachi agency',
  pitch: 'Property is a slow, high-ticket sale: what matters is how much stock is live, whether ' +
         'enquiries turn into viewings, and how long a listing sits before it moves. This tracks the ' +
         'whole chain from portal enquiry to commission cheque.',
  tabs: [
    { key: 'listings', sheet: 'Listings', cols: [
      C('id', 'Listing ID', 'text', ['id']),
      C('title', 'Property', 'text', ['title', 'name']),
      C('area', 'Area', 'badge', ['location', 'society']),
      C('type', 'Type', 'badge', ['category']),
      C('price', 'Asking Price', 'money', ['price']),
      C('status', 'Status', 'status'),
      C('listed', 'Listed On', 'date', ['date listed']),
      C('agent', 'Agent', 'text', ['owner'])
    ]},
    { key: 'enquiries', sheet: 'Enquiries', cols: [
      C('date', 'Date', 'date'),
      C('listing', 'Property'),
      C('client', 'Client', 'text', ['name']),
      C('source', 'Source', 'badge', ['channel', 'portal']),
      C('budget', 'Budget', 'money'),
      C('status', 'Status', 'status')
    ]},
    { key: 'deals', sheet: 'Deals', cols: [
      C('id', 'Deal ID', 'text', ['id']),
      C('listing', 'Property'),
      C('client', 'Buyer', 'text', ['client']),
      C('value', 'Sale Value', 'money', ['price', 'amount']),
      C('commission', 'Commission', 'money', ['fee']),
      C('closed', 'Closed On', 'date', ['date']),
      C('stage', 'Stage', 'status', ['status'])
    ]},
  ],
  dashboard: function (T) {
    var listings = T.listings, enq = T.enquiries, deals = T.deals;
    var now = new Date();

    var activeListings = listings.filter(function (l) { return !/sold|closed|withdrawn|expired/i.test(l.status); });
    var portfolio = sumF(activeListings, 'price');
    var newEnq = enq.filter(function (e) { return inLastDays_(e.date, 30); });

    var closed = deals.filter(function (d) { return /closed|sold|won|completed/i.test(d.stage) || isPaid_(d.stage); });
    var commission = sumF(closed, 'commission');
    var ytdCommission = sumWhere(deals, 'commission', function (d) { return d.closed && d.closed.getFullYear() === now.getFullYear(); });

    // Days on market: join closed deals back to their listing, and measure live stock to today.
    var listedByTitle = {};
    listings.forEach(function (l) { if (l.title) listedByTitle[l.title] = l.listed; });
    var dom = [];
    closed.forEach(function (d) {
      var listed = listedByTitle[d.listing];
      if (listed && d.closed) dom.push(Math.max(1, daysBetween_(listed, d.closed)));
    });
    activeListings.forEach(function (l) {
      if (l.listed) dom.push(Math.max(1, daysBetween_(l.listed, now)));
    });
    var avgDom = dom.length ? dom.reduce(function (a, b) { return a + b; }, 0) / dom.length : 0;

    var byMonth = monthly(deals, 'closed', 'commission', 12, function (d) { return toNumber_(d.commission) > 0; });
    var src = byKey(enq, 'source', null, 6);
    var stages = byKeyOrdered(deals, 'stage', 'value', ['Enquiry', 'Viewing', 'Negotiation', 'Token', 'Closed']);

    return {
      kpis: [
        KPI('Active Listings', activeListings.length, {
          format: 'number', icon: 'home', tone: 'brand',
          caption: listings.length + ' listings on the books',
          progress: ratio(activeListings.length, listings.length),
          progressLabel: pct_(activeListings.length, listings.length, 0) + ' still available',
        }),
        KPI('Portfolio Value', portfolio, {
          format: 'money', icon: 'wallet', tone: 'info',
          caption: 'Asking value of live stock',
        }),
        KPI('Enquiries (30d)', newEnq.length, {
          format: 'number', icon: 'users', tone: 'brand',
          caption: 'of ' + enq.length + ' lifetime enquiries',
          spark: monthly(enq, 'date', null, 12).values,
        }),
        KPI('Commission Earned', commission, {
          format: 'money', icon: 'check', tone: 'ok',
          caption: closed.length + ' deals closed · ' + money_(ytdCommission) + ' this year',
        }),
        KPI('Avg Days on Market', Math.round(avgDom), {
          format: 'days', icon: 'clock', tone: avgDom > 90 ? 'warn' : 'ok',
          caption: 'Target under 90 days',
        }),
        KPI('Avg Commission / Deal', ratio(commission, closed.length || 1), {
          format: 'money', icon: 'target', tone: 'info',
          caption: 'Avg sale ' + money_(ratio(sumF(closed, 'value'), closed.length || 1)),
        }),
      ],
      charts: [
        CHART('bars', 'Commission by month', 'Last 12 months, closed deals', byMonth.labels, byMonth.values),
        CHART('donut', 'Enquiry sources', 'Portals vs walk-ins vs referrals', split_(src).labels, split_(src).values, { format: 'number' }),
        CHART('hbars', 'Deal value by stage', 'Where the money is stuck', split_(stages).labels, split_(stages).values),
      ],
      table: TABLE('Recent listings', 'Newest stock added', listings, 'listed', [
        { key: 'title', label: 'Property', type: 'text' },
        { key: 'area', label: 'Area', type: 'badge' },
        { key: 'type', label: 'Type', type: 'badge' },
        { key: 'price', label: 'Asking', type: 'money' },
        { key: 'agent', label: 'Agent', type: 'text' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  03 · COACHING BUSINESS
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'coaching', name: 'Coaching & Courses', short: 'Coaching',
  icon: 'book', accent: '#8b5cf6',
  layout: { preset: 'grid' },
  tagline: 'Cohort revenue, attendance and completion for a coaching business',
  pitch: 'Coaching revenue is lumpy and churn hides in silence. This tracks cash collected per cohort, ' +
         'who actually shows up, and how much fee is still outstanding — the three things that decide ' +
         'whether the next cohort is profitable.',
  tabs: [
    { key: 'enrollments', sheet: 'Enrollments', cols: [
      C('date', 'Date', 'date', ['enrolled on']),
      C('student', 'Student', 'text', ['name']),
      C('program', 'Program', 'badge', ['course', 'cohort']),
      C('price', 'Fee', 'money', ['price', 'amount']),
      C('status', 'Status', 'status'),
      C('cohort', 'Cohort', 'badge', ['batch'])
    ]},
    { key: 'sessions', sheet: 'Sessions', cols: [
      C('date', 'Date', 'date'),
      C('student', 'Student', 'text', ['name']),
      C('program', 'Program', 'badge', ['course']),
      C('attended', 'Attended', 'text', ['present', 'attendance']),
      C('mode', 'Mode', 'badge', ['online', 'format'])
    ]},
    { key: 'payments', sheet: 'Payments', cols: [
      C('student', 'Student', 'text', ['name']),
      C('program', 'Program', 'badge', ['course']),
      C('amount', 'Amount', 'money', ['fee']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var enr = T.enrollments, ses = T.sessions, pay = T.payments;
    var now = new Date();

    var active = enr.filter(function (e) { return !/drop|cancel|refund/i.test(e.status); });
    var attended = countWhere(ses, function (s) { return /yes|true|1|present|attended/i.test(String(s.attended)); });
    var attendanceRate = ratio(attended, ses.length);
    var completed = countWhere(enr, function (e) { return /complete|graduat|finish/i.test(e.status); });

    var collected = sumWhere(pay, 'amount', function (p) { return isPaid_(p.status) || !!p.paid; });
    var outstanding = sumWhere(pay, 'amount', function (p) { return !isPaid_(p.status) && !p.paid; });
    var revenue = monthly(pay, 'paid', 'amount', 12, function (p) { return !!p.paid; });

    var byProgram = byKey(active, 'program', null, 6);
    var byMode = byKey(ses, 'mode', null, 4);
    var perStudent = ratio(collected, countWhere(pay, function (p) { return true; }) || 1);

    return {
      kpis: [
        KPI('Active Students', active.length, {
          format: 'number', icon: 'users', tone: 'brand',
          caption: enr.length + ' lifetime enrollments',
          spark: monthly(enr, 'date', null, 12).values,
        }),
        KPI('Collected Revenue', collected, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: 'All payments received',
          spark: revenue.values,
        }),
        KPI('Attendance Rate', attendanceRate, {
          format: 'percent', icon: 'check', tone: attendanceRate > 0.75 ? 'ok' : 'warn',
          caption: attended + ' of ' + ses.length + ' sessions attended',
          progress: attendanceRate, progressLabel: 'Target 80%+',
        }),
        KPI('Avg Fee / Student', perStudent, {
          format: 'money', icon: 'target', tone: 'info',
          caption: 'Across ' + pay.length + ' payment records',
        }),
        KPI('Outstanding Fees', outstanding, {
          format: 'money', icon: 'clock', tone: outstanding > 0 ? 'warn' : 'ok',
          caption: pct_(outstanding, outstanding + collected, 0) + ' of billed fees uncollected',
          alert: outstanding > 0,
        }),
        KPI('Completion Rate', ratio(completed, enr.length), {
          format: 'percent', icon: 'book', tone: 'info',
          caption: completed + ' students completed a program',
          progress: ratio(completed, enr.length), progressLabel: 'Cohort completion',
        }),
      ],
      charts: [
        CHART('line', 'Revenue collected', 'Last 12 months', revenue.labels, revenue.values),
        CHART('donut', 'Students by program', 'Where enrollment sits today', split_(byProgram).labels, split_(byProgram).values, { format: 'number' }),
        CHART('bars', 'Sessions by mode', 'Online vs on-site delivery', split_(byMode).labels, split_(byMode).values, { format: 'number' }),
      ],
      table: TABLE('Recent enrollments', 'Newest students', enr, 'date', [
        { key: 'student', label: 'Student', type: 'text' },
        { key: 'program', label: 'Program', type: 'badge' },
        { key: 'cohort', label: 'Cohort', type: 'badge' },
        { key: 'price', label: 'Fee', type: 'money' },
        { key: 'date', label: 'Enrolled', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  04 · RETAIL BOUTIQUE / E-COMMERCE
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'ecommerce', name: 'Retail Boutique · E-commerce', short: 'Store',
  icon: 'cart', accent: '#ec4899',
  layout: { preset: 'ledger' },
  tagline: 'Revenue, margin and repeat buyers for an online boutique',
  pitch: 'Online retail dashboards drown in vanity metrics. This one keeps the four numbers that decide ' +
         'profitability — revenue, average order value, gross margin and repeat rate — plus where the ' +
         'revenue actually comes from.',
  tabs: [
    { key: 'orders', sheet: 'Orders', cols: [
      C('id', 'Order ID', 'text', ['id', 'order']),
      C('date', 'Date', 'date', ['order date']),
      C('customer', 'Customer', 'text', ['name', 'buyer']),
      C('channel', 'Channel', 'badge', ['source', 'platform']),
      C('category', 'Category', 'badge', ['product category']),
      C('items', 'Items', 'num', ['units', 'qty']),
      C('revenue', 'Revenue', 'money', ['total', 'amount']),
      C('cost', 'Cost', 'money', ['cogs']),
      C('status', 'Status', 'status')
    ]},
    { key: 'products', sheet: 'Products', cols: [
      C('sku', 'SKU', 'text', ['code']),
      C('name', 'Product', 'text', ['name']),
      C('category', 'Category', 'badge'),
      C('price', 'Price', 'money'),
      C('cost', 'Cost', 'money', ['cogs']),
      C('stock', 'Stock', 'num', ['inventory']),
      C('sold', 'Units Sold', 'num', ['sold', 'units'])
    ]},
    { key: 'customers', sheet: 'Customers', cols: [
      C('id', 'Customer ID', 'text', ['id']),
      C('name', 'Name', 'text', ['customer']),
      C('city', 'City', 'badge'),
      C('firstOrder', 'First Order', 'date', ['joined', 'signup']),
      C('orders', 'Orders', 'num', ['order count']),
      C('ltv', 'Lifetime Value', 'money', ['ltv', 'spend']),
      C('segment', 'Segment', 'badge', ['tier'])
    ]},
  ],
  dashboard: function (T) {
    var orders = T.orders, products = T.products, customers = T.customers;
    var now = new Date();

    var valid = orders.filter(function (o) { return !/cancel|refund|return/i.test(o.status); });
    var revenue = sumF(valid, 'revenue');
    var cogs = sumF(valid, 'cost');
    var aov = ratio(revenue, valid.length);
    var margin = ratio(revenue - cogs, revenue);

    var monthOrders = valid.filter(function (o) { return o.date && sameMonth_(o.date, now); });
    var monthRevenue = sumF(monthOrders, 'revenue');

    var repeat = countWhere(customers, function (c) { return toNumber_(c.orders) > 1; });
    var repeatRate = ratio(repeat, customers.length);

    var refunds = countWhere(orders, function (o) { return /refund|return|cancel/i.test(o.status); });
    var revSeries = monthly(valid, 'date', 'revenue', 12);
    var cat = byKey(valid, 'category', 'revenue', 6);
    var chan = byKey(valid, 'channel', 'revenue', 6);

    var lowStock = products.filter(function (p) { return toNumber_(p.stock) <= 5; });

    return {
      kpis: [
        KPI('Revenue', revenue, {
          format: 'money', icon: 'cart', tone: 'brand',
          caption: money_(monthRevenue) + ' this month · ' + num_(valid.length) + ' orders',
          spark: revSeries.values,
        }),
        KPI('Orders', valid.length, {
          format: 'number', icon: 'check', tone: 'info',
          caption: num_(monthOrders.length) + ' in the current month',
          spark: monthly(valid, 'date', null, 12).values,
        }),
        KPI('Average Order Value', aov, {
          format: 'money', icon: 'target', tone: 'brand',
          caption: 'Avg ' + (ratio(sumF(valid, 'items'), valid.length)).toFixed(1) + ' items per order',
        }),
        KPI('Gross Margin', margin, {
          format: 'percent', icon: 'wallet', tone: margin > 0.45 ? 'ok' : 'warn',
          caption: 'COGS ' + pct_(cogs, revenue, 0) + ' of revenue',
          progress: margin, progressLabel: 'Target 50%+',
        }),
        KPI('Repeat Customers', repeatRate, {
          format: 'percent', icon: 'users', tone: repeatRate > 0.3 ? 'ok' : 'warn',
          caption: repeat + ' of ' + customers.length + ' bought more than once',
          progress: repeatRate, progressLabel: 'Healthy is 25–30%',
        }),
        KPI('Returns & Refunds', ratio(refunds, orders.length), {
          format: 'percent', icon: 'alert', tone: 'warn',
          caption: refunds + ' of ' + orders.length + ' orders',
          caption2: lowStock.length + ' SKUs low on stock',
        }),
      ],
      charts: [
        CHART('line', 'Revenue trend', 'Net of cancellations, 12 months', revSeries.labels, revSeries.values),
        CHART('donut', 'Revenue by category', 'Which lines carry the business', split_(cat).labels, split_(cat).values),
        CHART('hbars', 'Revenue by channel', 'Own site vs marketplaces vs social', split_(chan).labels, split_(chan).values),
      ],
      table: TABLE('Recent orders', 'Newest orders', orders, 'date', [
        { key: 'id', label: 'Order', type: 'text' },
        { key: 'customer', label: 'Customer', type: 'text' },
        { key: 'channel', label: 'Channel', type: 'badge' },
        { key: 'items', label: 'Items', type: 'num' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 200, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  05 · RESTAURANT & CAFÉ
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'restaurant', name: 'Restaurant & Café', short: 'Cafe',
  icon: 'coffee', accent: '#f97316',
  layout: { preset: 'gauge' },
  tagline: 'Daily sales, covers and prime cost for a café or restaurant',
  pitch: 'Restaurant margins are decided weekly, not monthly. Prime cost (food + labour) is the single ' +
         'number that makes or breaks the month — this puts it next to covers, average check and the ' +
         'delivery channel mix so decisions happen while they still matter.',
  tabs: [
    { key: 'sales', sheet: 'Daily Sales', cols: [
      C('date', 'Date', 'date'),
      C('covers', 'Covers', 'num', ['guests', 'pax']),
      C('revenue', 'Revenue', 'money', ['sales', 'total']),
      C('foodCost', 'Food Cost', 'money', ['cogs']),
      C('labour', 'Labour Cost', 'money', ['labor', 'wages']),
      C('delivery', 'Delivery Revenue', 'money', ['online']),
      C('channel', 'Channel', 'badge', ['daypart'])
    ]},
    { key: 'menu', sheet: 'Menu Items', cols: [
      C('item', 'Item', 'text', ['name', 'dish']),
      C('category', 'Category', 'badge'),
      C('price', 'Price', 'money'),
      C('cost', 'Cost', 'money', ['cogs']),
      C('sold', 'Units Sold', 'num', ['sold', 'qty'])
    ]},
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['type']),
      C('amount', 'Amount', 'money', ['cost']),
      C('vendor', 'Vendor', 'text', ['supplier']),
      C('note', 'Note', 'text', ['description'])
    ]},
  ],
  dashboard: function (T) {
    var sales = T.sales, menu = T.menu, expenses = T.expenses;
    var now = new Date();

    var last30 = sales.filter(function (s) { return inLastDays_(s.date, 30); });
    var revenue30 = sumF(last30, 'revenue');
    var covers30 = sumF(last30, 'covers');
    var foodCost = sumF(sales, 'foodCost');
    var labour = sumF(sales, 'labour');
    var totalRev = sumF(sales, 'revenue');
    var foodPct = ratio(foodCost, totalRev);
    var primePct = ratio(foodCost + labour, totalRev);
    var deliveryRev = sumF(sales, 'delivery');
    var check = ratio(revenue30, covers30);

    var daily = dailySeries(sales, 'date', 'revenue', 30);
    var catRevenue = menu.map(function (m) {
      return { label: m.category, value: toNumber_(m.sold) * toNumber_(m.price) };
    }).reduce(function (acc, x) {
      var found = acc.filter(function (a) { return a.label === x.label; })[0];
      if (found) found.value += x.value; else acc.push(x);
      return acc;
    }, []).sort(function (a, b) { return b.value - a.value; });

    // Channel split straight from the data: delivery revenue vs everything else.
    var channel = [
      { label: 'Dine-in', value: Math.max(0, totalRev - deliveryRev) },
      { label: 'Delivery apps', value: deliveryRev },
    ];
    var revenueSeries = monthly(sales, 'date', 'revenue', 12);

    return {
      kpis: [
        KPI('Revenue (30d)', revenue30, {
          format: 'money', icon: 'coffee', tone: 'brand',
          caption: num_(covers30) + ' covers · ' + money_(ratio(revenue30, 30)) + ' per day',
          spark: daily.values,
        }),
        KPI('Average Check', check, {
          format: 'money', icon: 'target', tone: 'info',
          caption: 'Revenue ÷ covers, last 30 days',
        }),
        KPI('Food Cost', foodPct, {
          format: 'percent', icon: 'cart', tone: foodPct > 0.35 ? 'danger' : foodPct > 0.32 ? 'warn' : 'ok',
          caption: 'Industry range 28–35%',
          progress: Math.min(1, foodPct / 0.5), progressLabel: 'Lower is better',
        }),
        KPI('Prime Cost', primePct, {
          format: 'percent', icon: 'wallet', tone: primePct > 0.65 ? 'danger' : primePct > 0.6 ? 'warn' : 'ok',
          caption: 'Food ' + pct_(foodCost, totalRev, 0) + ' + labour ' + pct_(labour, totalRev, 0),
          progress: Math.min(1, primePct / 0.8), progressLabel: 'Target under 60%',
        }),
        KPI('Delivery Share', ratio(deliveryRev, totalRev), {
          format: 'percent', icon: 'cart', tone: 'info',
          caption: money_(deliveryRev) + ' via delivery apps',
        }),
        KPI('Operating Expenses', sumF(expenses, 'amount'), {
          format: 'money', icon: 'clock', tone: 'warn',
          caption: expenses.length + ' expense entries recorded',
        }),
      ],
      charts: [
        CHART('line', 'Daily revenue', 'Last 30 trading days', daily.labels, daily.values, { format: 'money' }),
        CHART('donut', 'Revenue by category', 'Menu mix, from units sold', catRevenue.map(function (x) { return x.label; }), catRevenue.map(function (x) { return x.value; })),
        CHART('hbars', 'Revenue by channel', 'Dine-in vs delivery apps', split_(channel).labels, split_(channel).values),
      ],
      table: TABLE('Recent trading days', 'Daily takings', sales, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'covers', label: 'Covers', type: 'num' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
        { key: 'foodCost', label: 'Food', type: 'money' },
        { key: 'labour', label: 'Labour', type: 'money' },
        { key: 'channel', label: 'Daypart', type: 'badge' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  06 · SALON / SPA / AESTHETICS
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'salon', name: 'Salon · Spa · Aesthetics', short: 'Salon',
  icon: 'scissors', accent: '#db2777',
  layout: { preset: 'calendar' },
  tagline: 'Bookings, ticket size and rebooking for a salon or medspa',
  pitch: 'A salon is a chair-utilisation business. Every empty slot and every no-show is revenue that ' +
         'cannot be resold. This shows utilisation, average ticket and rebooking rate side by side — ' +
         'the three levers that actually grow a salon.',
  tabs: [
    { key: 'appointments', sheet: 'Appointments', cols: [
      C('date', 'Date', 'date', ['appointment date']),
      C('client', 'Client', 'text', ['name', 'customer']),
      C('service', 'Service', 'badge', ['treatment']),
      C('stylist', 'Stylist', 'text', ['staff', 'therapist', 'provider']),
      C('price', 'Price', 'money', ['amount', 'fee']),
      C('minutes', 'Minutes', 'num', ['duration']),
      C('rebooked', 'Rebooked', 'text', ['rebook']),
      C('status', 'Status', 'status')
    ]},
    { key: 'clients', sheet: 'Clients', cols: [
      C('name', 'Name', 'text', ['client']),
      C('phone', 'Phone', 'text', ['mobile']),
      C('firstVisit', 'First Visit', 'date', ['joined']),
      C('visits', 'Visits', 'num', ['bookings']),
      C('ltv', 'Lifetime Value', 'money', ['spend', 'ltv']),
      C('tier', 'Tier', 'badge', ['segment'])
    ]},
    { key: 'services', sheet: 'Services', cols: [
      C('service', 'Service', 'text', ['name', 'treatment']),
      C('category', 'Category', 'badge'),
      C('price', 'Price', 'money'),
      C('minutes', 'Minutes', 'num', ['duration']),
      C('sold', 'Units Sold', 'num', ['sold'])
    ]},
  ],
  dashboard: function (T) {
    var appts = T.appointments, clients = T.clients, services = T.services;
    var now = new Date();

    var noShow = appts.filter(function (a) { return /no.?show/i.test(a.status); });
    var cancelled = appts.filter(function (a) { return /cancel/i.test(a.status); });
    var done = appts.filter(function (a) { return !/no.?show|cancel/i.test(a.status); });
    var last30 = done.filter(function (a) { return inLastDays_(a.date, 30); });
    var rev30 = sumF(last30, 'price');
    var ticket = ratio(rev30, last30.length);
    var noShowRate = ratio(noShow.length + cancelled.length, appts.length);
    var rebooked = countWhere(appts, function (a) { return /yes|true|1/i.test(String(a.rebooked)); });
    var rebookRate = ratio(rebooked, appts.length);

    // Chair utilisation: booked minutes ÷ (chairs × 8h × 26 working days).
    // Two chairs is a boutique studio; raise it and the percentage drops accordingly.
    var STYLISTS = 2;
    var bookedMinutes = sumF(last30, 'minutes');
    var utilisation = Math.min(1, ratio(bookedMinutes, STYLISTS * 8 * 60 * 30));

    var revenue = monthly(done, 'date', 'price', 12);
    var byService = byKey(done, 'service', 'price', 6);
    var byStylist = byKey(done, 'stylist', 'price', 6);
    var returning = countWhere(clients, function (c) { return toNumber_(c.visits) > 1; });

    return {
      kpis: [
        KPI('Bookings (30d)', last30.length, {
          format: 'number', icon: 'calendar', tone: 'brand',
          caption: noShow.length + ' no-shows · ' + cancelled.length + ' cancellations',
          spark: monthly(done, 'date', null, 12).values,
        }),
        KPI('Revenue (30d)', rev30, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(ratio(rev30, 30)) + ' per trading day',
        }),
        KPI('Average Ticket', ticket, {
          format: 'money', icon: 'target', tone: 'brand',
          caption: 'Revenue ÷ completed appointments',
        }),
        KPI('No-show & Cancel', noShowRate, {
          format: 'percent', icon: 'alert', tone: noShowRate > 0.12 ? 'danger' : noShowRate > 0.08 ? 'warn' : 'ok',
          caption: 'Salon benchmark is 8–11%',
          progress: Math.min(1, noShowRate / 0.25), progressLabel: 'Lower is better',
        }),
        KPI('Rebooking Rate', rebookRate, {
          format: 'percent', icon: 'check', tone: rebookRate > 0.5 ? 'ok' : 'warn',
          caption: 'Top salons run 60–80%',
          progress: rebookRate, progressLabel: 'Clients booked before leaving',
        }),
        KPI('Chair Utilisation', utilisation, {
          format: 'percent', icon: 'clock', tone: utilisation > 0.7 ? 'ok' : 'warn',
          caption: num_(Math.round(bookedMinutes / 60)) + ' booked hours across ' + STYLISTS + ' chairs',
          caption2: returning + ' of ' + clients.length + ' clients are repeat',
          progress: utilisation, progressLabel: 'Target 75–85%',
        }),
      ],
      charts: [
        CHART('line', 'Revenue trend', 'Completed services, 12 months', revenue.labels, revenue.values),
        CHART('donut', 'Revenue by service', 'What clients actually pay for', split_(byService).labels, split_(byService).values),
        CHART('hbars', 'Revenue by stylist', 'Who is carrying the floor', split_(byStylist).labels, split_(byStylist).values),
      ],
      table: TABLE('Recent appointments', 'Newest bookings', appts, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'service', label: 'Service', type: 'badge' },
        { key: 'stylist', label: 'Stylist', type: 'text' },
        { key: 'price', label: 'Price', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 150, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  07 · GYM / FITNESS STUDIO
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'gym', name: 'Gym · Fitness Studio', short: 'Gym',
  icon: 'activity', accent: '#16a34a',
  layout: { preset: 'hero' },
  tagline: 'Members, MRR and churn for a boutique fitness studio',
  pitch: 'Fitness businesses leak members slowly and then all at once. Monthly churn, visits per member ' +
         'and renewals expiring in the next two weeks are the early-warning system — everything else ' +
         'is a lagging indicator.',
  tabs: [
    { key: 'members', sheet: 'Members', cols: [
      C('id', 'Member ID', 'text', ['id']),
      C('name', 'Name', 'text', ['member', 'client']),
      C('plan', 'Plan', 'badge', ['membership']),
      C('joinDate', 'Join Date', 'date', ['joined', 'start date']),
      C('endDate', 'Renewal Date', 'date', ['expiry', 'end date']),
      C('monthlyFee', 'Monthly Fee', 'money', ['fee', 'mrr']),
      C('trainer', 'Trainer', 'text', ['coach']),
      C('status', 'Status', 'status')
    ]},
    { key: 'attendance', sheet: 'Attendance', cols: [
      C('date', 'Date', 'date', ['check in']),
      C('member', 'Member', 'text', ['name']),
      C('class', 'Class', 'badge', ['session', 'activity']),
      C('checkin', 'Check-ins', 'num', ['visits', 'count'])
    ]},
    { key: 'payments', sheet: 'Payments', cols: [
      C('member', 'Member', 'text', ['name']),
      C('plan', 'Plan', 'badge', ['membership']),
      C('amount', 'Amount', 'money', ['fee']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var members = T.members, att = T.attendance, pay = T.payments;
    var now = new Date();

    var active = members.filter(function (m) { return !/cancel|churn|expired|inactive|hold/i.test(m.status); });
    var mrr = sumF(active, 'monthlyFee');
    var cancelled = members.filter(function (m) { return /cancel|churn/i.test(m.status); });
    var churnRate = ratio(cancelled.length, members.length);

    var expiring = active.filter(function (m) {
      var d = m.endDate ? daysBetween_(now, m.endDate) : -1;
      return d >= 0 && d <= 14;
    });

    var attLast14 = att.filter(function (a) { return inLastDays_(a.date, 14); });
    var visitsPerMember = ratio(sumF(attLast14, 'checkin'), active.length) / 2;   // per week

    var ptRevenue = sumWhere(pay, 'amount', function (p) { return /pt|personal|train/i.test(p.plan); });
    var mrrSeries = monthly(pay, 'paid', 'amount', 12, function (p) { return !!p.paid; });
    var plans = byKey(active, 'plan', null, 5);
    var weekday = byWeekday(att, 'date', 'checkin');

    return {
      kpis: [
        KPI('Active Members', active.length, {
          format: 'number', icon: 'users', tone: 'brand',
          caption: members.length + ' on the roster · ' + expiring.length + ' renewing soon',
          spark: monthly(members, 'joinDate', null, 12).values,
        }),
        KPI('Monthly Recurring', mrr, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: 'Avg ' + money_(ratio(mrr, active.length)) + ' per member',
          spark: mrrSeries.values,
        }),
        KPI('Monthly Churn', churnRate, {
          format: 'percent', icon: 'alert', tone: churnRate > 0.06 ? 'danger' : churnRate > 0.04 ? 'warn' : 'ok',
          caption: 'Industry average 3–5% a month',
          progress: Math.min(1, churnRate / 0.12), progressLabel: 'Lower is better',
        }),
        KPI('Visits / Member / Week', visitsPerMember, {
          format: 'number', icon: 'activity', tone: visitsPerMember >= 2 ? 'ok' : 'warn',
          caption: num_(sumF(attLast14, 'checkin')) + ' check-ins in the last 14 days',
        }),
        KPI('Renewals Due (14d)', expiring.length, {
          format: 'number', icon: 'calendar', tone: expiring.length > 10 ? 'warn' : 'info',
          caption: money_(sumF(expiring, 'monthlyFee')) + ' of MRR at risk',
        }),
        KPI('Personal Training', ptRevenue, {
          format: 'money', icon: 'target', tone: 'brand',
          caption: pct_(ptRevenue, sumF(pay, 'amount'), 0) + ' of all payments collected',
        }),
      ],
      charts: [
        CHART('line', 'Payments collected', '12-month trend', mrrSeries.labels, mrrSeries.values),
        CHART('donut', 'Members by plan', 'Membership mix', split_(plans).labels, split_(plans).values, { format: 'number' }),
        CHART('hbars', 'Check-ins by weekday', 'When the floor is busiest', weekday.labels, weekday.values, { format: 'number' }),
      ],
      table: TABLE('Recent members', 'Newest joins', members, 'joinDate', [
        { key: 'name', label: 'Member', type: 'text' },
        { key: 'plan', label: 'Plan', type: 'badge' },
        { key: 'monthlyFee', label: 'Monthly', type: 'money' },
        { key: 'joinDate', label: 'Joined', type: 'date' },
        { key: 'endDate', label: 'Renewal', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  08 · SCHOOL / ACADEMY
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'school', name: 'School · Academy', short: 'School',
  icon: 'book', accent: '#0284c7',
  layout: { preset: 'scorecard' },
  tagline: 'Enrollment, fee collection and attendance for a school',
  pitch: 'Schools run on fee collection cycles and attendance. A dashboard that shows arrears and ' +
         'collection rate by month lets the admin office chase the right parents before the term ends, ' +
         'instead of discovering a shortfall at salary time.',
  tabs: [
    { key: 'students', sheet: 'Students', cols: [
      C('id', 'Student ID', 'text', ['id']),
      C('name', 'Student', 'text', ['name']),
      C('grade', 'Grade', 'badge', ['class']),
      C('section', 'Section', 'badge', ['division']),
      C('joined', 'Admission Date', 'date', ['joined', 'date']),
      C('guardian', 'Guardian', 'text', ['parent']),
      C('monthlyFee', 'Monthly Fee', 'money', ['fee']),
      C('status', 'Status', 'status')
    ]},
    { key: 'attendance', sheet: 'Attendance', cols: [
      C('date', 'Date', 'date'),
      C('student', 'Student', 'text', ['name']),
      C('grade', 'Grade', 'badge', ['class']),
      C('present', 'Present', 'text', ['attended'])
    ]},
    { key: 'fees', sheet: 'Fees', cols: [
      C('student', 'Student', 'text', ['name']),
      C('grade', 'Grade', 'badge', ['class']),
      C('period', 'Period', 'badge', ['month', 'term']),
      C('amount', 'Amount', 'money', ['fee']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var students = T.students, att = T.attendance, fees = T.fees;
    var now = new Date();

    var enrolled = students.filter(function (s) { return !/left|withdraw|graduat|inactive/i.test(s.status); });
    var newAdmits = students.filter(function (s) { return inLastDays_(s.joined, 30); });

    var collected = sumWhere(fees, 'amount', function (f) { return isPaid_(f.status) || !!f.paid; });
    var billed = sumF(fees, 'amount');
    var arrears = billed - collected;
    var outstandingRows = fees.filter(function (f) { return !isPaid_(f.status) && !f.paid; });
    var overdueRows = outstandingRows.filter(function (f) { return isPast_(f.due); });

    var presented = countWhere(att, function (a) { return /yes|true|1|present/i.test(String(a.present)); });
    var attendanceRate = ratio(presented, att.length);

    var monthlyFees = monthly(fees, 'paid', 'amount', 12, function (f) { return !!f.paid; });
    var byGrade = byKey(enrolled, 'grade', null, 8);
    var attTrend = monthlyRate(att, 'date', function (a) { return /yes|true|1|present/i.test(String(a.present)); }, 12);

    return {
      kpis: [
        KPI('Enrolled Students', enrolled.length, {
          format: 'number', icon: 'users', tone: 'brand',
          caption: newAdmits.length + ' new admissions in 30 days',
          spark: monthly(students, 'joined', null, 12).values,
        }),
        KPI('Fee Collected', collected, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(monthlyFees.values[monthlyFees.values.length - 1]) + ' this month',
          spark: monthlyFees.values,
        }),
        KPI('Collection Rate', ratio(collected, billed), {
          format: 'percent', icon: 'check', tone: ratio(collected, billed) > 0.9 ? 'ok' : 'warn',
          caption: 'of ' + money_(billed) + ' billed',
          progress: ratio(collected, billed), progressLabel: 'Target 90%+',
        }),
        KPI('Outstanding Arrears', arrears, {
          format: 'money', icon: 'clock', tone: arrears > 0 ? 'danger' : 'ok',
          caption: overdueRows.length + ' of ' + outstandingRows.length + ' invoices past due',
          alert: overdueRows.length > 0,
        }),
        KPI('Attendance Rate', attendanceRate, {
          format: 'percent', icon: 'calendar', tone: attendanceRate > 0.9 ? 'ok' : 'warn',
          caption: presented + ' present of ' + att.length + ' records',
          progress: attendanceRate, progressLabel: 'Target 92%+',
        }),
        KPI('Avg Monthly Fee', avgF(enrolled, 'monthlyFee'), {
          format: 'money', icon: 'target', tone: 'info',
          caption: 'Expected ' + money_(sumF(enrolled, 'monthlyFee')) + ' per month',
        }),
      ],
      charts: [
        CHART('bars', 'Fee collection by month', 'Cash received, 12 months', monthlyFees.labels, monthlyFees.values),
        CHART('donut', 'Students by grade', 'Where enrollment sits', split_(byGrade).labels, split_(byGrade).values, { format: 'number' }),
        CHART('line', 'Attendance trend', 'Monthly attendance %', attTrend.labels, attTrend.values, { format: 'percent' }),
      ],
      table: TABLE('Recent admissions', 'Newest students', students, 'joined', [
        { key: 'name', label: 'Student', type: 'text' },
        { key: 'grade', label: 'Grade', type: 'badge' },
        { key: 'section', label: 'Section', type: 'badge' },
        { key: 'monthlyFee', label: 'Monthly Fee', type: 'money' },
        { key: 'joined', label: 'Admitted', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  09 · CLINIC / DENTAL
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'clinic', name: 'Clinic · Dental', short: 'Clinic',
  icon: 'heart', accent: '#0d9488',
  layout: { preset: 'grid' },
  tagline: 'Production, collections and no-shows for a dental practice',
  pitch: 'A dental practice has four dials: how many new patients arrive, how full the chair schedule is, ' +
         'what share of treatment is actually collected, and how old the receivables get. Moving any one ' +
         'of them moves profit faster than cutting costs.',
  tabs: [
    { key: 'appointments', sheet: 'Appointments', cols: [
      C('date', 'Date', 'date', ['appointment date']),
      C('patient', 'Patient', 'text', ['name', 'client']),
      C('provider', 'Provider', 'text', ['doctor', 'dentist']),
      C('treatment', 'Treatment', 'badge', ['procedure']),
      C('status', 'Status', 'status'),
      C('fee', 'Fee', 'money', ['amount', 'charge']),
      C('minutes', 'Minutes', 'num', ['duration'])
    ]},
    { key: 'patients', sheet: 'Patients', cols: [
      C('id', 'Patient ID', 'text', ['id']),
      C('name', 'Name', 'text', ['patient']),
      C('phone', 'Phone', 'text', ['mobile']),
      C('firstVisit', 'First Visit', 'date', ['joined', 'registered']),
      C('visits', 'Visits', 'num', ['appointments']),
      C('source', 'Source', 'badge', ['referral', 'channel'])
    ]},
    { key: 'treatments', sheet: 'Treatments', cols: [
      C('treatment', 'Treatment', 'text', ['procedure', 'name']),
      C('category', 'Category', 'badge', ['type']),
      C('price', 'Price', 'money', ['fee']),
      C('cost', 'Lab Cost', 'money', ['cost']),
      C('sold', 'Units Sold', 'num', ['count'])
    ]},
  ],
  dashboard: function (T) {
    var appts = T.appointments, patients = T.patients, treatments = T.treatments;
    var now = new Date();

    var newPatients = patients.filter(function (p) { return inLastDays_(p.firstVisit, 30); });
    var last30 = appts.filter(function (a) { return inLastDays_(a.date, 30); });
    var noShow = appts.filter(function (a) { return /no.?show/i.test(a.status); });
    // Only work that actually happened counts as production — a future booking is not revenue.
    var completed = appts.filter(function (a) {
      return /completed|paid|unpaid|partial/i.test(String(a.status));
    });
    var noShowRate = ratio(noShow.length, appts.length);

    var production = sumF(completed, 'fee');
    var production30 = sumF(completed.filter(function (a) { return inLastDays_(a.date, 30); }), 'fee');
    var collected = sumWhere(appts, 'fee', function (a) { return isPaid_(a.status); });
    var collectionRate = ratio(collected, production);

    // Receivables = completed treatment that has not been paid for.
    // No-shows, cancellations and future bookings are NOT debt — counting them inflates AR 3×.
    var unpaid = appts.filter(function (a) {
      return /unpaid|partial/i.test(String(a.status)) && toNumber_(a.fee) > 0;
    });
    var ar = sumF(unpaid, 'fee');
    var ar90 = sumF(unpaid.filter(function (a) { return a.date && daysBetween_(a.date, now) > 90; }), 'fee');

    var prodSeries = monthly(completed, 'date', 'fee', 12);
    var byCategory = {};
    completed.forEach(function (a) {
      var cat = 'General';
      for (var i = 0; i < treatments.length; i++) {
        if (prettify_(treatments[i].treatment) === prettify_(a.treatment)) { cat = treatments[i].category || 'General'; break; }
      }
      byCategory[cat] = (byCategory[cat] || 0) + toNumber_(a.fee);
    });
    var catList = Object.keys(byCategory).map(function (k) { return { label: k, value: byCategory[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 6);

    var weekday = byWeekday(appts, 'date', 'fee');

    return {
      kpis: [
        KPI('New Patients (30d)', newPatients.length, {
          format: 'number', icon: 'users', tone: 'brand',
          caption: patients.length + ' patients on file',
          spark: monthly(patients, 'firstVisit', null, 12).values,
        }),
        KPI('Appointments (30d)', last30.length, {
          format: 'number', icon: 'calendar', tone: 'info',
          caption: completed.length + ' completed of ' + appts.length + ' booked',
        }),
        KPI('No-show Rate', noShowRate, {
          format: 'percent', icon: 'alert', tone: noShowRate > 0.12 ? 'danger' : noShowRate > 0.08 ? 'warn' : 'ok',
          caption: 'Dental average 11–15%',
          progress: Math.min(1, noShowRate / 0.25), progressLabel: 'Lower is better',
        }),
        KPI('Production (30d)', production30, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(production) + ' lifetime · avg ' + money_(ratio(production, completed.length)) + ' per visit',
          spark: prodSeries.values,
        }),
        KPI('Collection Rate', collectionRate, {
          format: 'percent', icon: 'check', tone: collectionRate > 0.95 ? 'ok' : collectionRate > 0.9 ? 'warn' : 'danger',
          caption: 'Best practice is 98%+',
          progress: collectionRate, progressLabel: 'Collected ÷ production',
        }),
        KPI('AR over 90 days', ar90, {
          format: 'money', icon: 'clock', tone: ar90 > 0 ? 'danger' : 'ok',
          caption: money_(ar) + ' total receivable · ' + pct_(ar90, ar, 0) + ' is stale',
          alert: ar90 > 0,
        }),
      ],
      charts: [
        CHART('line', 'Production by month', 'Completed treatment value', prodSeries.labels, prodSeries.values),
        CHART('donut', 'Production by category', 'Where revenue comes from', catList.map(function (x) { return x.label; }), catList.map(function (x) { return x.value; })),
        CHART('hbars', 'Booked value by weekday', 'Schedule pressure', weekday.labels, weekday.values),
      ],
      table: TABLE('Recent appointments', 'Newest bookings', appts, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'patient', label: 'Patient', type: 'text' },
        { key: 'treatment', label: 'Treatment', type: 'badge' },
        { key: 'provider', label: 'Provider', type: 'text' },
        { key: 'fee', label: 'Fee', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 150, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  10 · TRAVEL AGENCY
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'travel', name: 'Travel Agency', short: 'Travel',
  icon: 'plane', accent: '#0891b2',
  layout: { preset: 'board' },
  tagline: 'Bookings, GMV and deposits for a travel agency',
  pitch: 'Travel agencies carry huge gross booking value on thin commission margins. What matters is ' +
         'how much of the GMV is confirmed, how much deposit is still uncollected, and which ' +
         'destinations actually make money.',
  tabs: [
    { key: 'bookings', sheet: 'Bookings', cols: [
      C('id', 'Booking ID', 'text', ['id', 'ref']),
      C('date', 'Date', 'date', ['booking date']),
      C('client', 'Client', 'text', ['name', 'customer']),
      C('destination', 'Destination', 'badge', ['city', 'country']),
      C('type', 'Type', 'badge', ['package type']),
      C('pax', 'Pax', 'num', ['passengers', 'travellers']),
      C('value', 'Booking Value', 'money', ['gmv', 'amount']),
      C('cost', 'Supplier Cost', 'money', ['cost']),
      C('status', 'Status', 'status'),
      C('agent', 'Agent', 'text', ['consultant'])
    ]},
    { key: 'packages', sheet: 'Packages', cols: [
      C('name', 'Package', 'text', ['name']),
      C('destination', 'Destination', 'badge'),
      C('type', 'Type', 'badge'),
      C('price', 'Price', 'money'),
      C('cost', 'Cost', 'money'),
      C('booked', 'Booked', 'num', ['sold'])
    ]},
    { key: 'payments', sheet: 'Payments', cols: [
      C('booking', 'Booking', 'text', ['booking id']),
      C('client', 'Client', 'text', ['name']),
      C('amount', 'Amount', 'money'),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var bookings = T.bookings, packages = T.packages, pay = T.payments;
    var now = new Date();

    var confirmed = bookings.filter(function (b) { return !/cancel|refund/i.test(b.status); });
    var cancelled = bookings.filter(function (b) { return /cancel|refund/i.test(b.status); });
    var gmv = sumF(confirmed, 'value');
    var cost = sumF(confirmed, 'cost');
    var margin = ratio(gmv - cost, gmv);
    var commission = gmv - cost;
    var last30 = confirmed.filter(function (b) { return inLastDays_(b.date, 30); });

    var pending = pay.filter(function (p) { return !isPaid_(p.status) && !p.paid; });
    var pendingAmt = sumF(pending, 'amount');

    var gmvSeries = monthly(confirmed, 'date', 'value', 12);
    var dest = byKey(confirmed, 'destination', 'value', 6);
    var agents = byKey(confirmed, 'agent', 'value', 6);

    return {
      kpis: [
        KPI('Bookings (30d)', last30.length, {
          format: 'number', icon: 'plane', tone: 'brand',
          caption: confirmed.length + ' confirmed lifetime bookings',
          spark: monthly(confirmed, 'date', null, 12).values,
        }),
        KPI('Gross Booking Value', gmv, {
          format: 'money', icon: 'wallet', tone: 'info',
          caption: money_(sumF(last30, 'value')) + ' booked this month',
        }),
        KPI('Commission Earned', commission, {
          format: 'money', icon: 'target', tone: 'ok',
          caption: pct_(margin, 1, 1) + ' margin on GMV',
          progress: Math.min(1, margin / 0.2), progressLabel: 'Typical 8–15%',
        }),
        KPI('Average Booking', ratio(gmv, confirmed.length), {
          format: 'money', icon: 'check', tone: 'brand',
          caption: (ratio(sumF(confirmed, 'pax'), confirmed.length)).toFixed(1) + ' pax per booking',
        }),
        KPI('Cancellation Rate', ratio(cancelled.length, bookings.length), {
          format: 'percent', icon: 'alert', tone: ratio(cancelled.length, bookings.length) > 0.1 ? 'warn' : 'ok',
          caption: cancelled.length + ' of ' + bookings.length + ' bookings',
        }),
        KPI('Pending Deposits', pendingAmt, {
          format: 'money', icon: 'clock', tone: pendingAmt > 0 ? 'warn' : 'ok',
          caption: pending.length + ' payments not yet received',
          alert: pending.length > 0,
        }),
      ],
      charts: [
        CHART('bars', 'GMV by month', 'Confirmed bookings, 12 months', gmvSeries.labels, gmvSeries.values),
        CHART('donut', 'Bookings by destination', 'GMV split by destination', split_(dest).labels, split_(dest).values),
        CHART('hbars', 'GMV by consultant', 'Who closes the big trips', split_(agents).labels, split_(agents).values),
      ],
      table: TABLE('Recent bookings', 'Newest bookings', bookings, 'date', [
        { key: 'id', label: 'Booking', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'destination', label: 'Destination', type: 'badge' },
        { key: 'pax', label: 'Pax', type: 'num' },
        { key: 'value', label: 'Value', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  11 · CONSTRUCTION CONTRACTOR
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'construction', name: 'Construction Contractor', short: 'Build',
  icon: 'tool', accent: '#b45309',
  layout: { preset: 'timeline' },
  tagline: 'Project margin, billing and receivables for a contractor',
  pitch: 'Contractors go broke with a full order book. Progress billing lags cost, retainage sits ' +
         'uncollected for months, and a 10% labour overrun can wipe out a quarter of the job margin. ' +
         'This shows margin per project and how much cash is stuck in receivables.',
  tabs: [
    { key: 'projects', sheet: 'Projects', cols: [
      C('id', 'Project ID', 'text', ['id', 'code']),
      C('name', 'Project', 'text', ['name', 'title']),
      C('client', 'Client', 'text', ['owner']),
      C('contract', 'Contract Value', 'money', ['value', 'amount']),
      C('start', 'Start Date', 'date'),
      C('end', 'Target End', 'date', ['end date', 'completion']),
      C('progress', 'Progress %', 'num', ['percent complete']),
      C('billed', 'Billed To Date', 'money', ['billed']),
      C('cost', 'Cost To Date', 'money', ['cost', 'spent']),
      C('status', 'Status', 'status')
    ]},
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('project', 'Project', 'text', ['project name']),
      C('category', 'Category', 'badge', ['type']),
      C('amount', 'Amount', 'money', ['cost']),
      C('vendor', 'Vendor', 'text', ['supplier'])
    ]},
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('invoice', 'Invoice', 'text', ['invoice no', 'ref']),
      C('project', 'Project', 'text', ['project name']),
      C('amount', 'Amount', 'money', ['total']),
      C('retention', 'Retention', 'money', ['retainage']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var projects = T.projects, expenses = T.expenses, inv = T.invoices;
    var now = new Date();

    var active = projects.filter(function (p) { return !/closed|handed|complete/i.test(p.status); });
    var backlog = sumF(active, 'contract');
    var totalContract = sumF(projects, 'contract');
    var totalBilled = sumF(projects, 'billed');
    var totalCost = sumF(projects, 'cost');
    var margin = ratio(totalBilled - totalCost, totalBilled);

    var billedMonth = sumWhere(inv, 'amount', function (i) { return i.due && sameMonth_(i.due, now); });
    var openInv = inv.filter(isOpenInvoice_);
    var receivables = sumF(openInv, 'amount');
    var retentionHeld = sumF(inv, 'retention');

    var overBudget = projects.filter(function (p) {
      var forecast = toNumber_(p.progress) > 0 ? toNumber_(p.cost) / (toNumber_(p.progress) / 100) : toNumber_(p.cost);
      return forecast > toNumber_(p.contract);
    });

    var billingSeries = monthly(inv, 'due', 'amount', 12);
    var costCats = byKey(expenses, 'category', 'amount', 6);
    var projectMargins = projects.slice(0, 6).map(function (p) {
      var m = toNumber_(p.billed) ? (toNumber_(p.billed) - toNumber_(p.cost)) / toNumber_(p.billed) : 0;
      return { label: p.name, value: Math.round(m * 1000) / 10 };
    }).sort(function (a, b) { return a.value - b.value; });

    return {
      kpis: [
        KPI('Active Projects', active.length, {
          format: 'number', icon: 'tool', tone: 'brand',
          caption: projects.length + ' projects on the books',
        }),
        KPI('Contract Backlog', backlog, {
          format: 'money', icon: 'briefcase', tone: 'info',
          caption: pct_(backlog, totalContract, 0) + ' of ' + money_(totalContract) + ' lifetime value',
          progress: ratio(backlog, totalContract), progressLabel: 'Work still to deliver',
        }),
        KPI('Billed This Month', billedMonth, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(totalBilled) + ' billed to date',
          spark: billingSeries.values,
        }),
        KPI('Receivables', receivables, {
          format: 'money', icon: 'clock', tone: receivables > 0 ? 'danger' : 'ok',
          caption: openInv.length + ' open invoices · ' + money_(retentionHeld) + ' retention held',
          alert: openInv.length > 0,
        }),
        KPI('Gross Margin', margin, {
          format: 'percent', icon: 'target', tone: margin > 0.18 ? 'ok' : margin > 0.12 ? 'warn' : 'danger',
          caption: 'GC average 14.8% · specialty 20%+',
          progress: Math.min(1, margin / 0.3), progressLabel: 'Billed minus cost',
        }),
        KPI('Over-budget Projects', overBudget.length, {
          format: 'number', icon: 'alert', tone: overBudget.length ? 'danger' : 'ok',
          caption: overBudget.length ? 'Forecast cost exceeds contract' : 'All projects tracking to budget',
        }),
      ],
      charts: [
        CHART('bars', 'Billing by month', 'Invoiced value, 12 months', billingSeries.labels, billingSeries.values),
        CHART('donut', 'Cost by category', 'Where project money goes', split_(costCats).labels, split_(costCats).values),
        CHART('hbars', 'Margin by project', 'Billed minus cost, %', projectMargins.map(function (x) { return x.label; }), projectMargins.map(function (x) { return x.value; }), { format: 'percent' }),
      ],
      table: TABLE('Active projects', 'Largest contracts first', projects, 'start', [
        { key: 'name', label: 'Project', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'contract', label: 'Contract', type: 'money' },
        { key: 'billed', label: 'Billed', type: 'money' },
        { key: 'progress', label: 'Progress', type: 'num' },
        { key: 'status', label: 'Status', type: 'status' },
      ]),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  12 · EVENT PHOTOGRAPHY STUDIO
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'photography', name: 'Event Photography Studio', short: 'Studio',
  icon: 'camera', accent: '#7c3aed',
  layout: { preset: 'calendar' },
  tagline: 'Seasonal bookings, package value and delivery pipeline',
  pitch: 'Wedding and event work is violently seasonal: a few months carry the year. Knowing how much ' +
         'of the season is already booked, what the average package is worth, and which events are ' +
         'still undelivered tells the studio whether to sell or to shoot.',
  tabs: [
    { key: 'events', sheet: 'Events', cols: [
      C('date', 'Date', 'date', ['event date', 'shoot date']),
      C('client', 'Client', 'text', ['name']),
      C('type', 'Event Type', 'badge', ['type', 'occasion']),
      C('venue', 'Venue', 'badge', ['location']),
      C('package', 'Package', 'badge', ['pkg']),
      C('revenue', 'Revenue', 'money', ['value', 'amount']),
      C('cost', 'Cost', 'money', ['expenses']),
      C('status', 'Status', 'status', ['delivery'])
    ]},
    { key: 'bookings', sheet: 'Bookings', cols: [
      C('date', 'Date', 'date', ['booked on']),
      C('client', 'Client', 'text', ['name']),
      C('eventType', 'Event Type', 'badge', ['type']),
      C('eventDate', 'Event Date', 'date', ['shoot date']),
      C('value', 'Value', 'money', ['amount', 'package value']),
      C('source', 'Source', 'badge', ['referral', 'channel']),
      C('status', 'Status', 'status')
    ]},
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['type']),
      C('amount', 'Amount', 'money', ['cost']),
      C('note', 'Note', 'text', ['description'])
    ]},
  ],
  dashboard: function (T) {
    var events = T.events, bookings = T.bookings, expenses = T.expenses;
    var now = new Date();

    var last30 = events.filter(function (e) { return inLastDays_(e.date, 30); });
    var revenue = sumF(events, 'revenue');
    var yearRevenue = sumWhere(events, 'revenue', function (e) { return e.date && e.date.getFullYear() === now.getFullYear(); });
    var avgPackage = ratio(revenue, events.length);
    var margin = ratio(revenue - sumF(events, 'cost'), revenue);

    var pendingDeliveries = events.filter(function (e) { return !/delivered|complete|closed/i.test(e.status); });
    var pipeline = bookings.filter(function (b) { return /tentative|pending|hold|enquir|proposal/i.test(b.status); });
    var confirmedBookings = bookings.filter(function (b) { return /confirm|booked|deposit|won/i.test(b.status); });
    var referral = bookings.filter(function (b) { return /referral|word/i.test(b.source); });

    var revSeries = monthly(events, 'date', 'revenue', 12);
    var types = byKey(events, 'type', 'revenue', 6);
    var sources = byKey(bookings, 'source', null, 6);

    return {
      kpis: [
        KPI('Events (30d)', last30.length, {
          format: 'number', icon: 'camera', tone: 'brand',
          caption: events.length + ' shoots delivered lifetime',
          spark: monthly(events, 'date', null, 12).values,
        }),
        KPI('Revenue This Year', yearRevenue, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(revenue) + ' lifetime · ' + pct_(margin, 1, 0) + ' margin',
          spark: revSeries.values,
        }),
        KPI('Average Package', avgPackage, {
          format: 'money', icon: 'target', tone: 'brand',
          caption: 'Revenue ÷ delivered events',
        }),
        KPI('Booked Pipeline', sumF(confirmedBookings, 'value'), {
          format: 'money', icon: 'briefcase', tone: 'info',
          caption: confirmedBookings.length + ' confirmed · ' + pipeline.length + ' still tentative',
        }),
        KPI('Pending Deliveries', pendingDeliveries.length, {
          format: 'number', icon: 'clock', tone: pendingDeliveries.length > 8 ? 'warn' : 'ok',
          caption: pendingDeliveries.length ? 'Galleries still in editing or awaiting selection' : 'All galleries delivered',
        }),
        KPI('Referral Share', ratio(referral.length, bookings.length), {
          format: 'percent', icon: 'users', tone: ratio(referral.length, bookings.length) > 0.3 ? 'ok' : 'warn',
          caption: referral.length + ' of ' + bookings.length + ' bookings came by referral',
          progress: ratio(referral.length, bookings.length), progressLabel: 'Healthy studios run 30%+',
        }),
      ],
      charts: [
        CHART('bars', 'Revenue by month', 'Wedding-season shape, 12 months', revSeries.labels, revSeries.values),
        CHART('donut', 'Revenue by event type', 'Weddings vs corporate vs portraits', split_(types).labels, split_(types).values),
        CHART('hbars', 'Bookings by source', 'Where shoots are won', split_(sources).labels, split_(sources).values, { format: 'number' }),
      ],
      table: TABLE('Recent events', 'Newest shoots', events, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'type', label: 'Type', type: 'badge' },
        { key: 'package', label: 'Package', type: 'badge' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 150, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  13 · SaaS / SOFTWARE   ← new
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'saas', name: 'SaaS · Software', short: 'SaaS',
  icon: 'cloud', accent: '#2563eb',
  layout: { preset: 'hero' },
  tagline: 'MRR, retention and support load for a software business',
  pitch: 'SaaS is a subscription machine: MRR is the score, net revenue retention is the engine, and ' +
         'churn is the leak. Support tickets belong on the same screen because they predict churn ' +
         'before the cancellation email does.',
  tabs: [
    { key: 'subscriptions', sheet: 'Subscriptions', cols: [
      C('id', 'Subscription ID', 'text', ['id']),
      C('customer', 'Customer', 'text', ['account', 'company']),
      C('plan', 'Plan', 'badge', ['tier']),
      C('mrr', 'MRR', 'money', ['monthly value']),
      C('seats', 'Seats', 'num', ['users']),
      C('start', 'Start Date', 'date', ['started', 'signed up']),
      C('churnDate', 'Churned On', 'date', ['cancelled', 'churn']),
      C('status', 'Status', 'status')
    ]},
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('invoice', 'Invoice', 'text', ['invoice no']),
      C('customer', 'Customer', 'text', ['account']),
      C('amount', 'Amount', 'money', ['total']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
    { key: 'tickets', sheet: 'Tickets', cols: [
      C('id', 'Ticket ID', 'text', ['id']),
      C('customer', 'Customer', 'text', ['account']),
      C('priority', 'Priority', 'badge', ['severity']),
      C('opened', 'Opened', 'date', ['created', 'date']),
      C('resolved', 'Resolved', 'date', ['closed']),
      C('csat', 'CSAT', 'num', ['satisfaction', 'score'])
    ]},
  ],
  dashboard: function (T) {
    var subs = T.subscriptions, inv = T.invoices, tickets = T.tickets;
    var now = new Date();

    var active = subs.filter(function (s) {
      return !/churn|cancel|inactive/i.test(s.status) && (!s.churnDate || isFuture_(s.churnDate));
    });
    var mrr = sumF(active, 'mrr');
    var arpa = ratio(mrr, active.length);

    var churned30 = subs.filter(function (s) { return s.churnDate && inLastDays_(s.churnDate, 30); });
    var churnRate = ratio(churned30.length, active.length + churned30.length);

    // MRR per month for the last 12 months (subscription-cohort view).
    var tz = scriptTZ_();
    var labels = [], mrrSeries = [], nrrLabels = [];
    for (var i = 11; i >= 0; i--) {
      var monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      labels.push(Utilities.formatDate(monthStart, tz, 'MMM'));
      var total = 0;
      subs.forEach(function (s) {
        if (!s.start || s.start >= monthEnd) return;
        if (s.churnDate && s.churnDate < monthStart) return;
        total += toNumber_(s.mrr);
      });
      mrrSeries.push(Math.round(total));
    }
    var growth = mrrSeries.length > 1 && mrrSeries[0] ? (mrrSeries[mrrSeries.length - 1] - mrrSeries[0]) / mrrSeries[0] : 0;

    // Net revenue retention — SAME cohort only. Taking total MRR now ÷ total MRR then would
    // bake new-customer growth into "retention" and report a fake 150%.
    var baseStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    var EXPANSION = 1.06;                                      // demo assumption: retained accounts grow ~6%/yr
    var baseMrr = 0, cohortNow = 0;
    subs.forEach(function (s) {
      if (!s.start || s.start >= baseStart) return;            // joined later → not in the cohort
      if (s.churnDate && s.churnDate < baseStart) return;      // already gone 12 months ago
      baseMrr += toNumber_(s.mrr) / EXPANSION;                 // what they were paying a year ago
      if (!s.churnDate || s.churnDate >= now) cohortNow += toNumber_(s.mrr);
    });
    var nrr = baseMrr ? cohortNow / baseMrr : 1;

    var openTickets = tickets.filter(function (t) { return !t.resolved; });
    var urgent = openTickets.filter(function (t) { return /high|urgent|critical|p1/i.test(t.priority); });
    var csat = avgF(tickets, 'csat', function (t) { return toNumber_(t.csat) > 0; });

    var plans = byKey(active, 'plan', 'mrr', 5);
    var prio = byKey(openTickets, 'priority', null, 4);   // open load, not lifetime volume
    var overdueInv = inv.filter(function (i) { return isOpenInvoice_(i) && isPast_(i.due); });

    return {
      kpis: [
        KPI('MRR', mrr, {
          format: 'money', icon: 'cloud', tone: 'brand',
          caption: 'ARR ' + money_(mrr * 12) + ' · ' + active.length + ' active accounts',
          spark: mrrSeries,
        }),
        KPI('Net Revenue Retention', nrr, {
          format: 'percent', icon: 'target', tone: nrr >= 1 ? 'ok' : 'warn',
          caption: nrr >= 1 ? 'Expansion is outpacing churn' : 'Revenue is shrinking from the existing base',
          progress: Math.min(1, nrr / 1.3), progressLabel: 'SMB median ~97% · mid-market 108%',
        }),
        KPI('Logo Churn (30d)', churnRate, {
          format: 'percent', icon: 'alert', tone: churnRate > 0.05 ? 'danger' : churnRate > 0.03 ? 'warn' : 'ok',
          caption: churned30.length + ' accounts churned this month',
          progress: Math.min(1, churnRate / 0.1), progressLabel: 'Lower is better',
        }),
        KPI('ARPA', arpa, {
          format: 'money', icon: 'users', tone: 'info',
          caption: (ratio(sumF(active, 'seats'), active.length)).toFixed(1) + ' seats per account',
        }),
        KPI('MRR Growth (12m)', growth, {
          format: 'percent', icon: 'activity', tone: growth > 0 ? 'ok' : 'danger',
          caption: money_(mrrSeries[0]) + ' → ' + money_(mrrSeries[mrrSeries.length - 1]),
        }),
        KPI('Open Tickets', openTickets.length, {
          format: 'number', icon: 'bell', tone: urgent.length > 5 ? 'warn' : 'info',
          caption: urgent.length + ' high priority · CSAT ' + (csat ? csat.toFixed(1) : '—') + '/5',
        }),
      ],
      charts: [
        CHART('line', 'MRR trend', 'Recurring revenue by month', labels, mrrSeries),
        CHART('donut', 'MRR by plan', 'Where revenue concentrates', split_(plans).labels, split_(plans).values),
        CHART('hbars', 'Open tickets by priority', 'Current support load', split_(prio).labels, split_(prio).values, { format: 'number' }),
      ],
      table: TABLE('Recent invoices', 'Newest subscription invoices', inv, 'due', [
        { key: 'invoice', label: 'Invoice', type: 'text' },
        { key: 'customer', label: 'Customer', type: 'text' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'paid', label: 'Paid', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 150, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  14 · LOGISTICS & FREIGHT   ← new
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'logistics', name: 'Logistics & Freight', short: 'Freight',
  icon: 'truck', accent: '#0f766e',
  layout: { preset: 'scorecard' },
  tagline: 'On-time performance, lane profitability and receivables',
  pitch: 'Freight is a promise business: customers pay for on-time, in-full delivery. OTIF, cost per ' +
         'shipment and revenue per lane show whether the operation is profitable or just busy — and ' +
         'receivables show whether the cash ever arrives.',
  tabs: [
    { key: 'shipments', sheet: 'Shipments', cols: [
      C('id', 'Shipment ID', 'text', ['id', 'consignment']),
      C('date', 'Date', 'date', ['dispatch date']),
      C('client', 'Client', 'text', ['customer']),
      C('origin', 'Origin', 'badge', ['from']),
      C('destination', 'Destination', 'badge', ['to', 'lane']),
      C('mode', 'Mode', 'badge', ['service']),
      C('weight', 'Weight (kg)', 'num', ['kg']),
      C('revenue', 'Revenue', 'money', ['amount', 'freight']),
      C('cost', 'Cost', 'money', ['expense']),
      C('ontime', 'On Time', 'text', ['otif', 'delivered on time']),
      C('status', 'Status', 'status')
    ]},
    { key: 'clients', sheet: 'Clients', cols: [
      C('name', 'Client', 'text', ['company']),
      C('tier', 'Tier', 'badge', ['segment']),
      C('volume', 'Monthly Shipments', 'num', ['volume']),
      C('revenue', 'Annual Revenue', 'money', ['value']),
      C('since', 'Client Since', 'date', ['start'])
    ]},
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('invoice', 'Invoice', 'text', ['invoice no']),
      C('client', 'Client', 'text', ['customer']),
      C('amount', 'Amount', 'money', ['total']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var ship = T.shipments, clients = T.clients, inv = T.invoices;
    var now = new Date();

    var onTime = countWhere(ship, function (s) { return /yes|true|1|on.?time/i.test(String(s.ontime)); });
    var otif = ratio(onTime, ship.length);
    var last30 = ship.filter(function (s) { return inLastDays_(s.date, 30); });
    var rev30 = sumF(last30, 'revenue');
    var revenue = sumF(ship, 'revenue');
    var cost = sumF(ship, 'cost');
    var costPer = ratio(cost, ship.length);
    var margin = ratio(revenue - cost, revenue);

    var exceptions = ship.filter(function (s) { return /delay|damage|exception|return|hold/i.test(s.status); });
    var openInv = inv.filter(isOpenInvoice_);
    var receivables = sumF(openInv, 'amount');

    var otifTrend = monthlyRate(ship, 'date', function (s) { return /yes|true|1|on.?time/i.test(String(s.ontime)); }, 12);
    var revSeries = monthly(ship, 'date', 'revenue', 12);
    var lanes = byKey(ship, 'destination', 'revenue', 6);
    var modes = byKey(ship, 'mode', null, 4);

    return {
      kpis: [
        KPI('Shipments (30d)', last30.length, {
          format: 'number', icon: 'truck', tone: 'brand',
          caption: num_(ship.length) + ' lifetime consignments',
          spark: monthly(ship, 'date', null, 12).values,
        }),
        KPI('On-Time Delivery', otif, {
          format: 'percent', icon: 'check', tone: otif > 0.95 ? 'ok' : otif > 0.9 ? 'warn' : 'danger',
          caption: 'World-class is 95%+ · target 90%+',
          progress: Math.min(1, otif / 1.0), progressLabel: 'OTIF performance',
        }),
        KPI('Revenue (30d)', rev30, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(revenue) + ' lifetime · ' + pct_(margin, 1, 1) + ' gross margin',
          spark: revSeries.values,
        }),
        KPI('Cost per Shipment', costPer, {
          format: 'money', icon: 'target', tone: 'info',
          caption: 'Revenue per shipment ' + money_(ratio(revenue, ship.length)),
        }),
        KPI('Receivables', receivables, {
          format: 'money', icon: 'clock', tone: receivables > 0 ? 'warn' : 'ok',
          caption: openInv.length + ' invoices outstanding',
          alert: openInv.length > 0,
        }),
        KPI('Exceptions', ratio(exceptions.length, ship.length), {
          format: 'percent', icon: 'alert', tone: ratio(exceptions.length, ship.length) > 0.05 ? 'danger' : 'ok',
          caption: exceptions.length + ' delayed, damaged or held',
        }),
      ],
      charts: [
        CHART('line', 'On-time performance', 'Monthly OTIF %', otifTrend.labels, otifTrend.values, { format: 'percent' }),
        CHART('bars', 'Revenue by month', 'Freight revenue, 12 months', revSeries.labels, revSeries.values),
        CHART('hbars', 'Top lanes', 'Revenue by destination', split_(lanes).labels, split_(lanes).values),
      ],
      table: TABLE('Recent shipments', 'Newest consignments', ship, 'date', [
        { key: 'id', label: 'Shipment', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'origin', label: 'From', type: 'badge' },
        { key: 'destination', label: 'To', type: 'badge' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 200, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  15 · LAW FIRM   ← new
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'lawfirm', name: 'Law Firm', short: 'Legal',
  icon: 'scale', accent: '#334155',
  layout: { preset: 'ledger' },
  tagline: 'Utilisation, realisation and lockup for a law practice',
  pitch: 'Law firms have a famous three-step leak: hours worked, hours billed, hours collected. ' +
         'Utilisation, realisation and collection rate measure each step — and lockup (WIP + AR days) ' +
         'is the number that decides whether the firm needs a credit line.',
  tabs: [
    { key: 'matters', sheet: 'Matters', cols: [
      C('id', 'Matter ID', 'text', ['id', 'file']),
      C('client', 'Client', 'text', ['name']),
      C('type', 'Practice Area', 'badge', ['matter type', 'area']),
      C('partner', 'Partner', 'text', ['owner', 'lead']),
      C('opened', 'Opened', 'date', ['open date']),
      C('status', 'Status', 'status'),
      C('feeType', 'Fee Type', 'badge', ['billing type']),
      C('budget', 'Budget', 'money', ['estimate'])
    ]},
    { key: 'time', sheet: 'Time Entries', cols: [
      C('date', 'Date', 'date'),
      C('matter', 'Matter', 'text', ['matter id']),
      C('timekeeper', 'Timekeeper', 'text', ['lawyer', 'fee earner']),
      C('hours', 'Hours', 'num', ['time']),
      C('rate', 'Rate', 'money', ['hourly rate']),
      C('billable', 'Billable', 'text', ['billable?'])
    ]},
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('invoice', 'Invoice', 'text', ['invoice no']),
      C('client', 'Client', 'text', ['name']),
      C('amount', 'Amount', 'money', ['total', 'billed']),
      C('due', 'Due Date', 'date'),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status')
    ]},
  ],
  dashboard: function (T) {
    var matters = T.matters, time = T.time, inv = T.invoices;
    var now = new Date();

    var billable = time.filter(function (t) { return /yes|true|1/i.test(String(t.billable)) || !t.billable; });
    var hours = sumF(billable, 'hours');
    var hoursMonth = sumF(billable.filter(function (t) { return inLastDays_(t.date, 30); }), 'hours');

    var TIMEKEEPERS = 4;   // fee earners on the book (capacity = ×160h/month)
    var utilisation = Math.min(1, ratio(hoursMonth, TIMEKEEPERS * 160));

    var workedValue = billable.reduce(function (s, t) { return s + toNumber_(t.hours) * toNumber_(t.rate); }, 0);
    var billedValue = sumF(inv, 'amount');
    var realisation = ratio(billedValue, workedValue);

    var collected = sumWhere(inv, 'amount', function (i) { return isPaid_(i.status) || !!i.paid; });
    var collectionRate = ratio(collected, billedValue);

    var openInv = inv.filter(isOpenInvoice_);
    var ar = sumF(openInv, 'amount');
    var wip = Math.max(0, workedValue - billedValue);
    var arBuckets = ageing(openInv, 'due', 'amount');

    var billedSeries = monthly(inv, 'due', 'amount', 12);
    var byArea = byKey(matters, 'type', null, 6);
    var hoursByArea = {};
    billable.forEach(function (t) {
      var area = 'General';
      for (var i = 0; i < matters.length; i++) {
        if (String(matters[i].id) === String(t.matter)) { area = matters[i].type || 'General'; break; }
      }
      hoursByArea[area] = (hoursByArea[area] || 0) + toNumber_(t.hours);
    });
    var hoursList = Object.keys(hoursByArea).map(function (k) { return { label: k, value: hoursByArea[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 6);

    return {
      kpis: [
        KPI('Billable Hours (30d)', hoursMonth, {
          format: 'hours', icon: 'clock', tone: 'brand',
          caption: num_(hours, 0) + ' hours recorded lifetime',
          spark: monthly(billable, 'date', 'hours', 12).values,
        }),
        KPI('Utilisation', utilisation, {
          format: 'percent', icon: 'target', tone: utilisation > 0.65 ? 'ok' : utilisation > 0.5 ? 'warn' : 'danger',
          caption: num_(TIMEKEEPERS) + ' fee earners × 160h capacity',
          progress: utilisation, progressLabel: 'Clio 2025 average is 38%',
        }),
        KPI('Realisation Rate', realisation, {
          format: 'percent', icon: 'check', tone: realisation > 0.9 ? 'ok' : realisation > 0.85 ? 'warn' : 'danger',
          caption: 'Industry average 88% of worked value billed',
          progress: Math.min(1, realisation), progressLabel: 'Worked → billed',
        }),
        KPI('Collection Rate', collectionRate, {
          format: 'percent', icon: 'wallet', tone: collectionRate > 0.93 ? 'ok' : 'warn',
          caption: 'Industry average 93%',
          progress: Math.min(1, collectionRate), progressLabel: 'Billed → collected',
        }),
        KPI('WIP (unbilled)', wip, {
          format: 'money', icon: 'briefcase', tone: wip > 0 ? 'info' : 'ok',
          caption: 'Work in progress not yet invoiced',
        }),
        KPI('Receivables', ar, {
          format: 'money', icon: 'clock', tone: ar > 0 ? 'warn' : 'ok',
          caption: openInv.length + ' invoices · ' + Math.round(ratio(ar, ratio(billedValue, 365))) + ' days lockup',
          alert: openInv.length > 0,
        }),
      ],
      charts: [
        CHART('bars', 'Billed by month', 'Invoiced fees, 12 months', billedSeries.labels, billedSeries.values),
        CHART('donut', 'Hours by practice area', 'Where the firm spends time', split_(hoursList).labels, split_(hoursList).values, { format: 'number' }),
        CHART('hbars', 'AR ageing', 'Receivables by age bucket', split_(arBuckets).labels, split_(arBuckets).values),
      ],
      table: TABLE('Recent invoices', 'Newest fee notes', inv, 'due', [
        { key: 'invoice', label: 'Invoice', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'paid', label: 'Paid', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 150, futureDays: 0 }),
    };
  },
},


/* ------------------------------------------------------------------------------------------------
 *  16 · BOUTIQUE HOTEL  (Islamabad)
 *  Unit story: rooms, room-nights and rate per night. Money is per-night, not per-order.
 *  Layout: hero — the occupancy number is the biggest thing on the page.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'hotel', name: 'Boutique Hotel · Islamabad', short: 'Hotel',
  icon: 'bed', accent: '#0891b2',
  layout: { preset: 'hero', kpiCols: 3 },
  tagline: 'Occupancy, ADR and RevPAR for a 44-room boutique property',
  pitch: 'Hotels do not sell rooms, they sell room-nights at a price that moves with the calendar. ' +
         'RevPAR (rate × occupancy) is the only number that cannot be flattered by discounting, so it ' +
         'sits next to ADR and the booking mix that produced it.',
  tabs: [
    { key: 'stays', sheet: 'Bookings', cols: [
      C('checkin', 'Check In', 'date', ['check in', 'arrival', 'date']),
      C('checkout', 'Check Out', 'date', ['check out', 'departure']),
      C('guest', 'Guest', 'text', ['name', 'guest name']),
      C('roomType', 'Room Type', 'badge', ['room', 'category']),
      C('roomNo', 'Room No', 'text', ['room number']),
      C('nights', 'Nights', 'num'),
      C('rate', 'Rate / Night', 'money', ['rate', 'tariff']),
      C('amount', 'Total', 'money', ['amount', 'folio', 'value']),
      C('source', 'Channel', 'badge', ['source', 'ota']),
      C('status', 'Status', 'status', ['booking status']),
    ] },
    { key: 'rooms', sheet: 'Rooms', cols: [
      C('roomNo', 'Room No', 'text', ['room']),
      C('type', 'Type', 'badge', ['room type', 'category']),
      C('rate', 'Rack Rate', 'money', ['rate', 'tariff']),
      C('floor', 'Floor', 'text'),
      C('status', 'Status', 'status'),
    ] },
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['head', 'type']),
      C('amount', 'Amount', 'money', ['total', 'value']),
      C('vendor', 'Vendor', 'text', ['supplier']),
      C('note', 'Note', 'text', ['description', 'remarks']),
    ] },
  ],
  dashboard: function (T) {
    var stays = T.stays, rooms = T.rooms;
    var now = new Date();
    var roomCount = rooms.length || 44;

    // Occupancy = room-nights sold ÷ room-nights available, over the last 30 nights.
    var monthAgo = addDays_(now, -30);
    var sold = 0, available = 0;
    stays.forEach(function (s) {
      if (!s.checkin || !s.nights) return;
      var out = s.checkout || addDays_(s.checkin, s.nights);
      var from = s.checkin > monthAgo ? s.checkin : monthAgo;
      var to = out < now ? out : now;
      var n = Math.max(0, daysBetween_(from, to));
      if (n > 0) sold += n;
    });
    available = roomCount * 30;
    var occ = ratio(sold, available);

    var occupied = stays.filter(function (s) {
      return /in.?house|checked.?in|occupied|staying/i.test(s.status);
    });

    var adr = ratio(sumF(occupied.length ? occupied : stays, 'rate'), occupied.length || stays.length);
    var revpar = adr * occ;

    var roomRev = sumWhere(stays, 'amount', function (s) { return sameMonth_(s.checkin, now); });
    var revenue = monthly(stays, 'checkin', 'amount', 12);

    var cancelled = countWhere(stays, function (s) { return /cancel|no.?show/i.test(s.status); });
    // Only stays that were actually consumed and left a balance — not future reservations.
    var outstanding = sumWhere(stays, 'amount', function (s) {
      return /balance due|unpaid|partial|city ledger/i.test(String(s.status)) &&
             s.checkin && daysBetween_(s.checkin, now) <= 90;
    });

    var los = ratio(sumF(stays, 'nights'), stays.length);
    var channels = byKey(stays, 'source', null, 6);
    var types = byKey(stays, 'roomType', 'amount', 6);
    var weekday = byWeekday(stays, 'checkin', 'nights');

    // Occupancy by month, so seasonality is visible (wedding season + summer break).
    var revMonthly = revenue.values;
    var occMonthly = monthly(stays, 'checkin', 'nights', 12).values.map(function (n) {
      return Math.round((n / (roomCount * 30)) * 1000) / 10;
    });

    return {
      kpis: [
        KPI('Occupancy · 30 days', occ, {
          format: 'percent', icon: 'bed', tone: occ >= 0.65 ? 'ok' : (occ >= 0.5 ? 'brand' : 'warn'),
          caption: sold + ' of ' + available + ' room-nights sold',
          caption2: 'RevPAR ' + money_(revpar) + ' · ' + roomCount + ' rooms',
          spark: occMonthly, progress: occ, progressLabel: roomCount + ' rooms · 30-night window',
        }),
        KPI('ADR', adr, {
          format: 'money', icon: 'wallet', tone: 'brand',
          caption: 'Average daily rate across all room types',
        }),
        KPI('RevPAR', revpar, {
          format: 'money', icon: 'spark', tone: revpar > 18000 ? 'ok' : 'warn',
          caption: 'ADR × occupancy — the number discounting cannot hide',
          spark: revMonthly,
        }),
        KPI('Room Revenue · This Month', roomRev, {
          format: 'money', icon: 'check', tone: 'ok',
          caption: '12-month total ' + money_(revenue.values.reduce(function (a, b) { return a + b; }, 0)),
        }),
        KPI('Outstanding Folios', outstanding, {
          format: 'money', icon: 'clock', tone: outstanding > 0 ? 'danger' : 'ok',
          caption: 'Checked-out stays carrying a balance (city ledger)',
          alert: outstanding > 0,
        }),
        KPI('Average Length of Stay', los, {
          format: 'number', dp: 1, unit: 'nights', icon: 'calendar', tone: 'info',
          caption: cancelled + ' cancellations / no-shows on file',
          progress: ratio(stays.length - cancelled, stays.length),
          progressLabel: pct_(stays.length - cancelled, stays.length, 0) + ' of bookings honoured',
        }),
      ],
      charts: [
        CHART('line', 'Room revenue', 'Billed room-nights, last 12 months', revenue.labels, revenue.values),
        CHART('donut', 'Booking channels', 'Reservations by source', split_(channels).labels, split_(channels).values, { format: 'number' }),
        CHART('bars', 'Occupancy by month', 'Room-nights sold ÷ rooms available', revenue.labels, occMonthly, { format: 'percent' }),
      ],
      table: TABLE('Latest reservations', 'Newest arrivals and their folio status', stays, 'checkin', [
        { key: 'guest', label: 'Guest', type: 'text' },
        { key: 'roomType', label: 'Room', type: 'badge' },
        { key: 'checkin', label: 'In', type: 'date' },
        { key: 'nights', label: 'Nights', type: 'num' },
        { key: 'rate', label: 'Rate', type: 'money' },
        { key: 'amount', label: 'Total', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 90, futureDays: 21 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  17 · MANUFACTURING PLANT  (injection moulding / plastics)
 *  Unit story: OEE is a percentage of percentages — availability × performance × quality.
 *  Layout: gauge — six small instrument tiles across the top, like a shop-floor HMI.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'factory', name: 'Manufacturing Plant · Plastics', short: 'Factory',
  icon: 'factory', accent: '#f97316',
  layout: { preset: 'gauge', kpiCols: 6 },
  tagline: 'OEE, scrap and downtime for a three-line moulding plant',
  pitch: 'Plant managers argue about output; the money is in OEE. This breaks OEE into its three ' +
         'honest parts — was the machine running, did it run at rate, did it make good parts — and ' +
         'then shows which downtime reason is eating the shift.',
  tabs: [
    { key: 'production', sheet: 'Production', cols: [
      C('date', 'Date', 'date'),
      C('line', 'Line', 'badge', ['machine', 'cell']),
      C('shift', 'Shift', 'text'),
      C('plannedMin', 'Planned Min', 'num', ['planned minutes']),
      C('runMin', 'Run Min', 'num', ['run minutes', 'uptime']),
      C('good', 'Good Units', 'num', ['good qty', 'ok qty']),
      C('reject', 'Rejected', 'num', ['reject qty', 'scrap']),
      C('downtimeMin', 'Downtime Min', 'num', ['down minutes']),
      C('idealRate', 'Ideal / Min', 'num', ['ideal rate', 'cycle']),
    ] },
    { key: 'downtime', sheet: 'Downtime', cols: [
      C('date', 'Date', 'date'),
      C('machine', 'Machine', 'badge', ['line']),
      C('reason', 'Reason', 'badge', ['cause']),
      C('minutes', 'Minutes', 'num', ['duration']),
      C('note', 'Note', 'text', ['remarks']),
    ] },
    { key: 'orders', sheet: 'Orders', cols: [
      C('date', 'Order Date', 'date'),
      C('customer', 'Customer', 'text', ['client']),
      C('part', 'Part', 'text', ['product', 'item']),
      C('qty', 'Qty', 'num', ['units']),
      C('value', 'Value', 'money', ['amount']),
      C('due', 'Due', 'date', ['delivery date']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var prod = T.production, down = T.downtime, orders = T.orders;

    // OEE = availability × performance × quality, weighted by planned minutes.
    var planned = 0, run = 0, good = 0, reject = 0, idealUnits = 0;
    prod.forEach(function (p) {
      var pm = toNumber_(p.plannedMin), rm = toNumber_(p.runMin);
      var g = toNumber_(p.good), r = toNumber_(p.reject);
      planned += pm; run += rm; good += g; reject += r;
      idealUnits += rm * (toNumber_(p.idealRate) || 1);
    });

    var availability = ratio(run, planned);
    var performance = ratio(good + reject, idealUnits);
    var quality = ratio(good, good + reject);
    var oee = availability * performance * quality;

    var shiftDowntime = 0;
    prod.forEach(function (p) { shiftDowntime += toNumber_(p.downtimeMin); });

    var mtd = prod.filter(function (p) { return sameMonth_(p.date, new Date()); });
    var outputMtd = sumF(mtd, 'good');

    var reasons = byKey(down, 'reason', 'minutes', 6);
    var byLine = {};
    prod.forEach(function (p) {
      var k = String(p.line || 'Line');
      byLine[k] = byLine[k] || { planned: 0, run: 0, good: 0, reject: 0, ideal: 0 };
      byLine[k].planned += toNumber_(p.plannedMin);
      byLine[k].run += toNumber_(p.runMin);
      byLine[k].good += toNumber_(p.good);
      byLine[k].reject += toNumber_(p.reject);
      byLine[k].ideal += toNumber_(p.runMin) * (toNumber_(p.idealRate) || 1);
    });
    var lineNames = Object.keys(byLine);
    var lineOee = lineNames.map(function (k) {
      var b = byLine[k];
      var a = ratio(b.run, b.planned), pe = ratio(b.good + b.reject, b.ideal), q = ratio(b.good, b.good + b.reject);
      return Math.round(a * pe * q * 1000) / 10;
    });

    var daily = dailySeries(prod, 'date', 'good', 30);
    var openOrders = orders.filter(function (o) { return !/delivered|complete|shipped|closed/i.test(o.status); });
    var late = openOrders.filter(function (o) { return isPast_(o.due); });

    return {
      kpis: [
        KPI('OEE', oee, {
          format: 'percent', icon: 'activity', tone: oee >= 0.65 ? 'ok' : (oee >= 0.5 ? 'warn' : 'danger'),
          caption: 'A ' + pct_(availability, 1, 0) + ' × P ' + pct_(performance, 1, 0) + ' × Q ' + pct_(quality, 1, 0),
          progress: oee, progressLabel: 'World class is 85%',
        }),
        KPI('Availability', availability, {
          format: 'percent', icon: 'clock', tone: availability >= 0.9 ? 'ok' : 'warn',
          caption: Math.round(shiftDowntime / 60) + ' machine-hours lost to downtime',
        }),
        KPI('Performance', performance, {
          format: 'percent', icon: 'spark', tone: performance >= 0.9 ? 'ok' : 'warn',
          caption: 'Actual vs ideal cycle output',
        }),
        KPI('Quality', quality, {
          format: 'percent', icon: 'check', tone: quality >= 0.98 ? 'ok' : (quality >= 0.95 ? 'warn' : 'danger'),
          caption: num_(reject) + ' rejected of ' + num_(good + reject) + ' moulded',
        }),
        KPI('Good Output · MTD', outputMtd, {
          format: 'number', unit: 'pcs', icon: 'box', tone: 'brand',
          caption: 'Last 30 days: ' + num_(daily.values.reduce(function (a, b) { return a + b; }, 0)) + ' pcs',
        }),
        KPI('Value Past Due', sumF(late, 'value'), {
          format: 'money', icon: 'alert', tone: late.length ? 'danger' : 'ok',
          caption: late.length + ' of ' + openOrders.length + ' open orders late · ' +
                   money_(sumF(openOrders, 'value')) + ' booked',
          alert: late.length > 0,
        }),
      ],
      charts: [
        CHART('line', 'Good units per day', 'Moulded output, last 30 days', daily.labels, daily.values, { format: 'number' }),
        CHART('donut', 'Downtime by reason', 'Machine-minutes lost, all lines', split_(reasons).labels, split_(reasons).values, { format: 'number' }),
        CHART('bars', 'OEE by line', 'A × P × Q per machine', lineNames, lineOee, { format: 'percent' }),
      ],
      table: TABLE('Production runs', 'Latest shift entries by date', prod, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'line', label: 'Line', type: 'badge' },
        { key: 'shift', label: 'Shift', type: 'text' },
        { key: 'good', label: 'Good', type: 'num' },
        { key: 'reject', label: 'Reject', type: 'num' },
        { key: 'downtimeMin', label: 'Downtime', type: 'num' },
      ], { withinDays: 45, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  18 · RECRUITMENT AGENCY
 *  Unit story: days and percentages of salary — time-to-fill, fill rate, fee as % of CTC.
 *  Layout: ledger — the placement ledger sits beside the fee numbers.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'recruitment', name: 'Recruitment Agency', short: 'Recruiting',
  icon: 'users', accent: '#7c3aed',
  layout: { preset: 'ledger'},
  tagline: 'Fill rate, time-to-fill and fees for a contingency recruiter',
  pitch: 'A recruitment desk is judged on three things: how many of the roles you took actually ' +
         'closed, how long they took, and what the fee was worth as a share of salary. Everything ' +
         'else is activity theatre.',
  tabs: [
    { key: 'roles', sheet: 'Roles', cols: [
      C('opened', 'Opened', 'date', ['date opened', 'received']),
      C('client', 'Client', 'text', ['company']),
      C('title', 'Role', 'text', ['position', 'job']),
      C('salary', 'Annual CTC', 'money', ['salary', 'package']),
      C('feePct', 'Fee %', 'num', ['fee percent', 'commission']),
      C('fee', 'Fee', 'money', ['amount', 'invoice value']),
      C('status', 'Status', 'status', ['stage']),
      C('filled', 'Filled On', 'date', ['closed date', 'placement date']),
    ] },
    { key: 'candidates', sheet: 'Candidates', cols: [
      C('date', 'Added', 'date', ['date', 'applied']),
      C('name', 'Candidate', 'text', ['name']),
      C('role', 'Role', 'text', ['position']),
      C('stage', 'Stage', 'status', ['status']),
      C('source', 'Source', 'badge', ['channel']),
      C('owner', 'Consultant', 'text', ['recruiter']),
    ] },
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('date', 'Invoice Date', 'date', ['date']),
      C('client', 'Client', 'text', ['company']),
      C('role', 'Role', 'text', ['position']),
      C('amount', 'Amount', 'money', ['total', 'fee']),
      C('due', 'Due', 'date', ['due date']),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var roles = T.roles, cands = T.candidates, inv = T.invoices;
    var now = new Date();

    var filled = roles.filter(function (r) { return /filled|placed|closed|won/i.test(r.status); });
    var open = roles.filter(function (r) { return !/filled|placed|closed|won|lost|cancel|on.?hold/i.test(r.status); });
    var dead = roles.filter(function (r) { return /lost|cancel|dropped|withdrawn/i.test(r.status); });

    var fillRate = ratio(filled.length, Math.max(1, filled.length + dead.length));   // concluded mandates only
    var ttf = ratio(filled.reduce(function (s, r) {
      var end = r.filled || now;
      return s + Math.max(1, daysBetween_(r.opened, end));
    }, 0), filled.length || 1);

    var feesMtd = sumWhere(roles, 'fee', function (r) { return sameMonth_(r.filled, now); });
    var placementsMtd = countWhere(roles, function (r) { return sameMonth_(r.filled, now); });
    var avgFee = ratio(sumF(filled, 'fee'), filled.length);
    var avgFeePct = ratio(sumF(filled, 'feePct'), filled.length);

    var feeSeries = monthly(roles, 'filled', 'fee', 12);
    var openValue = sumWhere(roles, 'fee', function (r) {
      return !/filled|placed|closed|won|lost|cancel/i.test(r.status);
    });

    var overdue = inv.filter(function (i) { return isOpenInvoice_(i) && isPast_(i.due); });
    var sources = byKey(cands, 'source', null, 6);
    var stages = byKeyOrdered(cands, 'stage', null, ['Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer', 'Placed'], ['Rejected', 'Withdrawn']);

    var activeClients = byKey(roles, 'client', 'fee', 6);

    return {
      kpis: [
        KPI('Open Roles', open.length, {
          format: 'number', icon: 'briefcase', tone: 'brand',
          caption: money_(openValue) + ' of fee value in play',
        }),
        KPI('Fill Rate', fillRate, {
          format: 'percent', icon: 'check', tone: fillRate >= 0.7 ? 'ok' : (fillRate >= 0.55 ? 'warn' : 'danger'),
          caption: filled.length + ' filled · ' + dead.length + ' lost · ' + open.length + ' still open',
          progress: fillRate, progressLabel: 'Benchmark 70–80%',
        }),
        KPI('Time to Fill', ttf, {
          format: 'days', icon: 'clock', tone: ttf <= 45 ? 'ok' : 'warn',
          caption: 'Median benchmark 39 days (non-executive)',
        }),
        KPI('Fees · This Month', feesMtd, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: placementsMtd + ' placements · avg ' + money_(avgFee),
          spark: feeSeries.values,
        }),
        KPI('Average Fee %', avgFeePct / 100, {
          format: 'percent', icon: 'scale', tone: 'info',
          caption: 'Contingency market runs 15–25% of first-year CTC',
        }),
        KPI('Invoices Overdue', sumF(overdue, 'amount'), {
          format: 'money', icon: 'alert', tone: overdue.length ? 'danger' : 'ok',
          caption: overdue.length + ' client invoices past due',
          alert: overdue.length > 0,
        }),
      ],
      charts: [
        CHART('line', 'Fees billed', 'Placement fees by month', feeSeries.labels, feeSeries.values),
        CHART('donut', 'Candidate sources', 'Where the pipeline actually comes from', split_(sources).labels, split_(sources).values, { format: 'number' }),
        CHART('hbars', 'Candidates by stage', 'Live pipeline snapshot', split_(stages).labels, split_(stages).values, { format: 'number' }),
      ],
      table: TABLE('Open mandates', 'Roles still being worked, newest first', open, 'opened', [
        { key: 'title', label: 'Role', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'salary', label: 'CTC', type: 'money' },
        { key: 'feePct', label: 'Fee %', type: 'num' },
        { key: 'fee', label: 'Fee', type: 'money' },
        { key: 'opened', label: 'Opened', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 120, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  19 · COMMUNITY PHARMACY
 *  Unit story: scripts per day, gross margin on Rx vs OTC, and days of stock.
 *  Layout: calendar — a vertical stack of daily dispensing charts with a narrow KPI rail.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'pharmacy', name: 'Community Pharmacy', short: 'Pharmacy',
  icon: 'pill', accent: '#059669',
  layout: { preset: 'calendar' },
  tagline: 'Scripts, margins and stock cover for a high-street pharmacy',
  pitch: 'A pharmacy makes most of its money on a shrinking share of the counter. What matters is ' +
         'how many scripts walk in, what margin survives after the distributor, and whether the fast ' +
         'movers are on the shelf before the customer gives up and goes elsewhere.',
  tabs: [
    { key: 'sales', sheet: 'Sales', cols: [
      C('date', 'Date', 'date'),
      C('rx', 'Scripts', 'num', ['prescriptions', 'rx count']),
      C('rxSales', 'Rx Sales', 'money', ['prescription sales']),
      C('otcSales', 'OTC Sales', 'money', ['counter sales', 'otc']),
      C('cost', 'Cost of Goods', 'money', ['cogs', 'purchase cost']),
      C('gross', 'Gross Profit', 'money', ['gp', 'margin']),
    ] },
    { key: 'inventory', sheet: 'Inventory', cols: [
      C('item', 'Item', 'text', ['product', 'medicine']),
      C('category', 'Category', 'badge', ['group', 'therapeutic class']),
      C('qty', 'On Hand', 'num', ['stock', 'quantity']),
      C('cost', 'Cost', 'money', ['purchase price']),
      C('price', 'Retail', 'money', ['mrp', 'selling price']),
      C('reorder', 'Reorder Level', 'num', ['min stock']),
      C('expiry', 'Expiry', 'date', ['expiry date']),
    ] },
    { key: 'purchases', sheet: 'Purchases', cols: [
      C('date', 'Date', 'date'),
      C('vendor', 'Distributor', 'text', ['supplier']),
      C('amount', 'Amount', 'money', ['total', 'value']),
      C('items', 'Lines', 'num', ['item count']),
      C('status', 'Status', 'status'),
      C('due', 'Due', 'date', ['payment due']),
    ] },
  ],
  dashboard: function (T) {
    var sales = T.sales, inv = T.inventory, purch = T.purchases;
    var now = new Date();

    var last30 = sales.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });
    var rxTotal = sumF(last30, 'rx');
    var rxPerDay = ratio(rxTotal, 30 || last30.length);

    var rev = sumF(last30, 'rxSales') + sumF(last30, 'otcSales');
    var gross = sumF(last30, 'gross');
    var margin = ratio(gross, rev);
    var otcShare = ratio(sumF(last30, 'otcSales'), rev);

    var stockValue = inv.reduce(function (s, i) { return s + toNumber_(i.qty) * toNumber_(i.cost); }, 0);
    var cogs30 = sumF(last30, 'cost');
    var coverDays = ratio(stockValue, cogs30 / 30);

    var stockouts = inv.filter(function (i) { return toNumber_(i.qty) <= toNumber_(i.reorder); });
    var soon = addDays_(now, 90);
    var expiryRisk = inv.filter(function (i) { return i.expiry && i.expiry <= soon; });

    var rxDaily = dailySeries(sales, 'date', 'rx', 30);
    var profitDaily = dailySeries(sales, 'date', 'gross', 30);
    var catValue = {};
    inv.forEach(function (i) {
      var k = prettify_(i.category) || 'Unspecified';
      catValue[k] = (catValue[k] || 0) + toNumber_(i.qty) * toNumber_(i.cost);
    });
    var cats = Object.keys(catValue).map(function (k) { return { label: k, value: catValue[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
    var vendors = byKey(purch, 'vendor', 'amount', 6);
    var unpaid = purch.filter(function (p) { return !isPaid_(p.status); });

    return {
      kpis: [
        KPI('Scripts per Day', rxPerDay, {
          format: 'number', dp: 0, icon: 'pill', tone: rxPerDay >= 210 ? 'ok' : 'warn',
          caption: 'NCPA average is 217/day; 183 is break-even',
          spark: rxDaily.values,
        }),
        KPI('Gross Margin', margin, {
          format: 'percent', icon: 'wallet', tone: margin >= 0.209 ? 'ok' : (margin >= 0.175 ? 'warn' : 'danger'),
          caption: money_(gross) + ' GP on ' + money_(rev) + ' of sales (30d)',
          progress: margin, progressLabel: 'Sector average 20.9%',
        }),
        KPI('Stock Cover', coverDays, {
          format: 'number', dp: 0, unit: 'days', icon: 'box', tone: coverDays >= 25 && coverDays <= 45 ? 'ok' : 'warn',
          caption: money_(stockValue) + ' on shelf · target 25–35 days',
        }),
        KPI('Below Reorder', stockouts.length, {
          format: 'number', icon: 'alert', tone: stockouts.length > inv.length * 0.05 ? 'danger' : 'warn',
          caption: 'of ' + inv.length + ' lines — stockout above 2% is lost sales',
          alert: stockouts.length > inv.length * 0.05,
        }),
        KPI('Expiry Risk (90d)', expiryRisk.reduce(function (a, i) {
          return a + toNumber_(i.qty) * toNumber_(i.cost);
        }, 0), {
          format: 'money', icon: 'clock', tone: expiryRisk.length > inv.length * 0.06 ? 'danger' : 'info',
          caption: expiryRisk.length + ' lines expiring within 90 days',
        }),
        KPI('OTC Share', otcShare, {
          format: 'percent', icon: 'cart', tone: 'brand',
          caption: 'Counter sales vs prescription — the higher-margin half',
        }),
      ],
      charts: [
        CHART('line', 'Scripts dispensed', 'Daily prescription count, last 30 days', rxDaily.labels, rxDaily.values, { format: 'number' }),
        CHART('donut', 'Stock value by category', 'Where the working capital sits', split_(cats).labels, split_(cats).values),
        CHART('hbars', 'Top distributors', 'Purchase value by supplier', split_(vendors).labels, split_(vendors).values),
      ],
      table: TABLE('Daily dispensing', 'Scripts, sales and margin by day', sales, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'rx', label: 'Scripts', type: 'num' },
        { key: 'rxSales', label: 'Rx Sales', type: 'money' },
        { key: 'otcSales', label: 'OTC', type: 'money' },
        { key: 'gross', label: 'GP', type: 'money' },
      ], { withinDays: 21, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  20 · BROILER POULTRY FARM
 *  Unit story: FCR (kg feed per kg bird), mortality %, live weight, rupees per kg.
 *  Layout: scorecard — the flock table is the scorecard; numbers read left, records right.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'poultry', name: 'Broiler Poultry Farm', short: 'Poultry',
  icon: 'bird', accent: '#ca8a04',
  layout: { preset: 'scorecard' },
  tagline: 'FCR, mortality and live weight per flock cycle',
  pitch: 'A broiler farm is a feed-conversion business with a five-week clock. FCR tells you whether ' +
         'the feed is turning into chicken, mortality tells you whether the shed is healthy, and the ' +
         'realised rate per kg tells you whether the cycle made money.',
  tabs: [
    { key: 'flocks', sheet: 'Flocks', cols: [
      C('batch', 'Batch', 'text', ['flock', 'batch no']),
      C('placed', 'Placed', 'date', ['placement date', 'chicks in']),
      C('birds', 'Birds Placed', 'num', ['chicks', 'quantity']),
      C('feedKg', 'Feed (kg)', 'num', ['feed consumed']),
      C('mortality', 'Mortality', 'num', ['deaths']),
      C('weight', 'Avg Weight (kg)', 'num', ['avg weight', 'live weight']),
      C('fcr', 'FCR', 'num'),
      C('status', 'Status', 'status'),
    ] },
    { key: 'daily', sheet: 'Daily Log', cols: [
      C('date', 'Date', 'date'),
      C('batch', 'Batch', 'text', ['flock']),
      C('feedKg', 'Feed (kg)', 'num', ['feed']),
      C('water', 'Water (L)', 'num', ['water intake']),
      C('deaths', 'Deaths', 'num', ['mortality']),
      C('tempC', 'Shed °C', 'num', ['temperature']),
    ] },
    { key: 'sales', sheet: 'Sales', cols: [
      C('date', 'Date', 'date'),
      C('batch', 'Batch', 'text', ['flock']),
      C('birds', 'Birds', 'num', ['quantity']),
      C('liveKg', 'Live Kg', 'num', ['weight', 'kg']),
      C('rate', 'Rate / Kg', 'money', ['rate']),
      C('amount', 'Amount', 'money', ['total', 'value']),
      C('buyer', 'Buyer', 'text', ['party', 'customer']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var flocks = T.flocks, daily = T.daily, sales = T.sales;
    var now = new Date();

    var live = flocks.filter(function (f) { return /active|live|growing|in.?shed/i.test(f.status); });
    var fTotalFeed = sumF(flocks, 'feedKg');
    var fTotalKg = flocks.reduce(function (s, f) {
      return s + toNumber_(f.birds) * (toNumber_(f.weight) || 0);
    }, 0);
    var fcr = ratio(fTotalFeed, fTotalKg);

    var placed = sumF(flocks, 'birds');
    var dead = sumF(flocks, 'mortality');
    var mortality = ratio(dead, placed);

    var birdsInShed = live.reduce(function (s, f) { return s + toNumber_(f.birds) - toNumber_(f.mortality); }, 0);
    var avgWeight = ratio(sumF(flocks, 'weight'), flocks.length);

    var last30 = sales.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });
    var ratePerKg = ratio(sumF(last30, 'amount'), sumF(last30, 'liveKg'));
    var revenue30 = sumF(last30, 'amount');
    var feedCostPerKgGain = ratio(sumF(last30, 'amount') * 0.66, sumF(last30, 'liveKg'));

    var feedDaily = dailySeries(daily, 'date', 'feedKg', 30);
    var deathsDaily = dailySeries(daily, 'date', 'deaths', 30);

    var batches = flocks.slice(0, 6);
    var batchLabels = batches.map(function (f) { return String(f.batch || '—').split('-').pop(); });
    var batchMort = batches.map(function (f) {
      return Math.round(ratio(toNumber_(f.mortality), toNumber_(f.birds)) * 1000) / 10;
    });
    var buyers = byKey(sales, 'buyer', 'amount', 5);

    var unpaid = sales.filter(function (s) { return !isPaid_(s.status); });

    return {
      kpis: [
        KPI('Feed Conversion (FCR)', fcr, {
          format: 'number', dp: 2, icon: 'activity', tone: fcr <= 1.7 ? 'ok' : (fcr <= 1.8 ? 'warn' : 'danger'),
          caption: 'kg feed per kg live weight — 1.5–1.7 is good',
          progress: Math.min(1, ratio(1.8, Math.max(fcr, 0.1))),
          progressLabel: 'Lower is better',
        }),
        KPI('Mortality', mortality, {
          format: 'percent', icon: 'heart', tone: mortality <= 0.05 ? 'ok' : (mortality <= 0.07 ? 'warn' : 'danger'),
          caption: num_(dead) + ' losses of ' + num_(placed) + ' chicks placed',
        }),
        KPI('Average Live Weight', avgWeight, {
          format: 'number', dp: 2, unit: 'kg', icon: 'box', tone: 'brand',
          caption: live.length + (live.length === 1 ? ' flock' : ' flocks') + ' still in the shed',
        }),
        KPI('Birds in Shed', birdsInShed, {
          format: 'number', icon: 'bird', tone: 'info',
          caption: 'Live birds across ' + live.length + ' active batch' + (live.length === 1 ? '' : 'es'),
        }),
        KPI('Feed Cost / kg Gain', feedCostPerKgGain, {
          format: 'money', icon: 'wallet', tone: 'warn',
          caption: 'Feed is ~66% of the cost of a bird',
        }),
        KPI('Realised Rate / kg', ratePerKg, {
          format: 'money', icon: 'scale', tone: ratePerKg > 400 ? 'ok' : 'warn',
          caption: money_(revenue30) + ' sold in 30 days · ' + money_(sumF(unpaid, 'amount')) + ' on credit',
          spark: monthly(sales, 'date', 'amount', 12).values,
        }),
      ],
      charts: [
        CHART('line', 'Daily feed intake', 'Kg of feed per day, last 30 days', feedDaily.labels, feedDaily.values, { format: 'number' }),
        CHART('bars', 'Mortality by batch', 'Percentage lost per flock', batchLabels, batchMort, { format: 'percent' }),
        CHART('donut', 'Sales by buyer', 'Where the birds go', split_(buyers).labels, split_(buyers).values),
      ],
      table: TABLE('Flock register', 'Batches and their conversion results', flocks, 'placed', [
        { key: 'batch', label: 'Batch', type: 'text' },
        { key: 'placed', label: 'Placed', type: 'date' },
        { key: 'birds', label: 'Birds', type: 'num' },
        { key: 'feedKg', label: 'Feed kg', type: 'num' },
        { key: 'weight', label: 'Avg kg', type: 'num' },
        { key: 'fcr', label: 'FCR', type: 'num' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 400, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  21 · FUEL STATION  (retail pump + convenience store)
 *  Unit story: litres, rupees of dealer margin per litre (government-set), and shop rupees.
 *  Layout: board — the shift log is the board; the KPI strip reads along the bottom.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'fuelstation', name: 'Fuel Station · Retail Pump', short: 'Fuel',
  icon: 'fuel', accent: '#dc2626',
  layout: { preset: 'board', kpiCols: 6 },
  tagline: 'Litres, per-litre dealer margin and shop sales for a retail pump',
  pitch: 'The dealer margin on petrol and diesel is fixed by the regulator, so profit cannot come ' +
         'from price. It comes from litres moved, from the shop on the forecourt, and from how much ' +
         'of the day’s sales walked out on credit.',
  tabs: [
    { key: 'shifts', sheet: 'Shift Sales', cols: [
      C('date', 'Date', 'date'),
      C('shift', 'Shift', 'text', ['shift name']),
      C('product', 'Product', 'badge', ['fuel', 'grade']),
      C('litres', 'Litres', 'num', ['quantity', 'volume']),
      C('rate', 'Retail Rate', 'money', ['rate', 'price']),
      C('margin', 'Dealer Margin / L', 'money', ['margin', 'dealer margin']),
      C('amount', 'Sale Value', 'money', ['amount', 'total']),
      C('pump', 'Pump', 'text', ['nozzle']),
    ] },
    { key: 'shop', sheet: 'Shop Sales', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['group']),
      C('qty', 'Qty', 'num', ['units']),
      C('amount', 'Amount', 'money', ['sales', 'value']),
      C('cost', 'Cost', 'money', ['purchase']),
    ] },
    { key: 'credit', sheet: 'Credit Ledger', cols: [
      C('customer', 'Customer', 'text', ['party', 'account']),
      C('date', 'Since', 'date', ['date opened']),
      C('amount', 'Outstanding', 'money', ['balance', 'due']),
      C('vehicle', 'Vehicle', 'text', ['fleet', 'plate']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var shifts = T.shifts, shop = T.shop, credit = T.credit;
    var now = new Date();

    var last30 = shifts.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });
    var litres30 = sumF(last30, 'litres');
    var litresPerDay = litres30 / 30;

    var marginPerL = ratio(sumWhere(last30, 'margin', function () { return true; }), last30.length);
    var fuelGp = last30.reduce(function (s, r) { return s + toNumber_(r.litres) * toNumber_(r.margin); }, 0);

    var shop30 = shop.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });
    var shopSales = sumF(shop30, 'amount');
    var shopGp = shop30.reduce(function (s, r) { return s + toNumber_(r.amount) - toNumber_(r.cost); }, 0);

    var fuelSales = sumF(last30, 'amount');
    var gp = fuelGp + shopGp;
    var shopShare = ratio(shopSales, fuelSales + shopSales);

    var outstanding = sumF(credit, 'amount');
    var creditOverdue = credit.filter(function (c) { return isPast_(c.date); });

    var byProduct = byKey(shifts, 'product', 'litres', 4);
    var byCat = byKey(shop, 'category', 'amount', 6);
    var dailyLitres = dailySeries(shifts, 'date', 'litres', 30);
    var dailyAmount = dailySeries(shifts, 'date', 'amount', 30);

    return {
      kpis: [
        KPI('Litres per Day', litresPerDay, {
          format: 'number', dp: 0, unit: 'L', icon: 'fuel', tone: 'brand',
          caption: num_(litres30) + ' L sold in 30 days',
          spark: dailyLitres.values,
        }),
        KPI('Dealer Margin', marginPerL, {
          format: 'number', dp: 2, unit: 'Rs/L', icon: 'scale', tone: 'info',
          caption: 'Regulator-set; OMC margin and IFEM sit on top',
        }),
        KPI('Fuel Gross Profit · 30d', fuelGp, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: money_(fuelSales) + ' of fuel sold at regulated rates',
        }),
        KPI('Shop Sales · 30d', shopSales, {
          format: 'money', icon: 'cart', tone: 'ok',
          caption: money_(shopGp) + ' shop GP · ' + pct_(shopShare, 1, 1) + ' of turnover',
          progress: shopShare, progressLabel: 'Forecourt shop share of turnover',
        }),
        KPI('Credit Outstanding', outstanding, {
          format: 'money', icon: 'clock', tone: outstanding > 1500000 ? 'danger' : 'warn',
          caption: creditOverdue.length + ' accounts carrying a balance',
          alert: outstanding > 1500000,
        }),
        KPI('Gross Profit · 30d', gp, {
          format: 'money', icon: 'spark', tone: 'ok',
          caption: 'Fuel + shop combined contribution',
          spark: dailyAmount.values,
        }),
      ],
      charts: [
        CHART('line', 'Litres sold per day', 'All products, last 30 days', dailyLitres.labels, dailyLitres.values, { format: 'number' }),
        CHART('donut', 'Product mix', 'Volume split by grade', split_(byProduct).labels, split_(byProduct).values, { format: 'number' }),
        CHART('hbars', 'Shop sales by category', 'Forecourt store turnover', split_(byCat).labels, split_(byCat).values),
      ],
      table: TABLE('Shift sales log', 'Latest pump readings by date', shifts, 'date', [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'shift', label: 'Shift', type: 'text' },
        { key: 'product', label: 'Product', type: 'badge' },
        { key: 'pump', label: 'Pump', type: 'text' },
        { key: 'litres', label: 'Litres', type: 'num' },
        { key: 'margin', label: 'Margin/L', type: 'money' },
        { key: 'amount', label: 'Value', type: 'money' },
      ], { withinDays: 10, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  22 · MANAGED IT SERVICES (MSP)
 *  Unit story: minutes to first response, hours to resolve, endpoints per engineer.
 *  Layout: timeline — a single reading column, because an SLA story is read top to bottom.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'msp', name: 'Managed IT Services · MSP', short: 'MSP',
  icon: 'server', accent: '#2563eb',
  layout: { preset: 'timeline', kpiCols: 6 },
  tagline: 'SLA adherence, first response and endpoint load for an MSP',
  pitch: 'Managed services is a contract business: you promise a response time, a resolution time ' +
         'and an uptime, then you staff to keep them. This shows whether the promise is being kept ' +
         'before the quarterly review does.',
  tabs: [
    { key: 'tickets', sheet: 'Tickets', cols: [
      C('opened', 'Opened', 'date', ['date', 'created']),
      C('client', 'Client', 'text', ['company', 'account']),
      C('priority', 'Priority', 'badge', ['severity']),
      C('category', 'Category', 'badge', ['type', 'issue']),
      C('frt', 'First Response (min)', 'num', ['first response', 'frt']),
      C('resolved', 'Resolved', 'date', ['closed', 'resolved date']),
      C('hours', 'Hours to Resolve', 'num', ['resolution hours', 'handle time']),
      C('engineer', 'Engineer', 'text', ['owner', 'assigned to']),
      C('sla', 'SLA', 'status', ['sla status', 'met']),
    ] },
    { key: 'contracts', sheet: 'Contracts', cols: [
      C('client', 'Client', 'text', ['company']),
      C('seats', 'Endpoints', 'num', ['devices', 'seats']),
      C('mrr', 'Monthly Fee', 'money', ['mrr', 'retainer']),
      C('tier', 'Tier', 'badge', ['plan', 'package']),
      C('renews', 'Renews', 'date', ['renewal date']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('date', 'Invoice Date', 'date'),
      C('client', 'Client', 'text', ['company']),
      C('amount', 'Amount', 'money', ['total', 'value']),
      C('due', 'Due', 'date', ['due date']),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var tickets = T.tickets, contracts = T.contracts, inv = T.invoices;
    var now = new Date();

    var open = tickets.filter(function (t) { return !/resolved|closed|done|cancelled/i.test(t.sla) && !t.resolved; });
    var last30 = tickets.filter(function (t) { return t.opened && daysBetween_(t.opened, now) <= 30; });
    var closed30 = last30.filter(function (t) { return !!t.resolved; });

    var met = countWhere(last30, function (t) { return /met|within|yes|ok/i.test(String(t.sla)); });
    var slaPct = ratio(met, last30.length);

    var frts = last30.map(function (t) { return toNumber_(t.frt); }).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
    var frtMedian = frts.length ? frts[Math.floor(frts.length / 2)] : 0;

    var avgResolve = ratio(closed30.reduce(function (s, t) { return s + toNumber_(t.hours); }, 0), closed30.length || 1);
    var mrr = sumWhere(contracts, 'mrr', function (c) { return !/churn|cancel|ended/i.test(c.status); });
    var endpoints = sumWhere(contracts, 'seats', function (c) { return !/churn|cancel|ended/i.test(c.status); });
    var engineers = {};
    last30.forEach(function (t) { if (t.engineer) engineers[t.engineer] = 1; });
    var engCount = Object.keys(engineers).length || 1;

    var ticketsDaily = dailySeries(tickets, 'opened', null, 30);
    var cats = byKey(last30, 'category', null, 6);
    var byClient = byKey(last30, 'client', null, 6);
    var overdue = inv.filter(function (i) { return isOpenInvoice_(i) && isPast_(i.due); });
    var p1 = last30.filter(function (t) { return /p1|critical|high/i.test(String(t.priority)); });

    return {
      kpis: [
        KPI('Open Tickets', open.length, {
          format: 'number', icon: 'bell', tone: open.length > 60 ? 'warn' : 'brand',
          caption: p1.length + ' P1/high tickets in the last 30 days',
        }),
        KPI('SLA Adherence', slaPct, {
          format: 'percent', icon: 'check', tone: slaPct >= 0.95 ? 'ok' : (slaPct >= 0.9 ? 'warn' : 'danger'),
          caption: met + ' of ' + last30.length + ' tickets in the last 30 days',
          progress: slaPct, progressLabel: 'Contract target is 95%',
        }),
        KPI('First Response (median)', frtMedian, {
          format: 'number', unit: 'min', icon: 'clock', tone: frtMedian <= 15 ? 'ok' : 'warn',
          caption: 'P1 target ≤ 15 minutes',
        }),
        KPI('Avg Resolution', avgResolve, {
          format: 'hours', icon: 'activity', tone: avgResolve <= 24 ? 'ok' : 'warn',
          caption: closed30.length + ' tickets closed in the window',
        }),
        KPI('Recurring Revenue', mrr, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: contracts.length + ' contracts · ' + num_(endpoints) + ' endpoints under management',
          spark: monthly(inv, 'date', 'amount', 12).values,
        }),
        KPI('Endpoints per Engineer', ratio(endpoints, engCount), {
          format: 'number', icon: 'server', tone: 'info',
          caption: engCount + ' engineers active · 400–500 is the practical ceiling',
        }),
      ],
      charts: [
        CHART('line', 'Ticket volume', 'Tickets opened per day, last 30 days', ticketsDaily.labels, ticketsDaily.values, { format: 'number' }),
        CHART('donut', 'Tickets by category', 'What clients actually call about', split_(cats).labels, split_(cats).values, { format: 'number' }),
        CHART('hbars', 'Busiest clients', 'Tickets raised in 30 days', split_(byClient).labels, split_(byClient).values, { format: 'number' }),
      ],
      table: TABLE('Ticket queue', 'Newest tickets and their SLA outcome', tickets, 'opened', [
        { key: 'opened', label: 'Opened', type: 'date' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'priority', label: 'Priority', type: 'badge' },
        { key: 'category', label: 'Issue', type: 'text' },
        { key: 'frt', label: '1st Response', type: 'num' },
        { key: 'engineer', label: 'Engineer', type: 'text' },
        { key: 'sla', label: 'SLA', type: 'status' },
      ], { withinDays: 14, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  23 · CAR WORKSHOP & DEALERSHIP
 *  Unit story: job cards, bay-hours sold, parts margin, comeback rate.
 *  Layout: gauge — instrument tiles, because a workshop is managed on throughput.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'autoshop', name: 'Auto Workshop & Dealership', short: 'Workshop',
  icon: 'car', accent: '#475569',
  layout: { preset: 'gauge', kpiCols: 6 },
  tagline: 'Job cards, bay utilisation and parts margin for a service centre',
  pitch: 'A workshop has a fixed number of bays and a fixed number of hours in a day; profit is ' +
         'how much of that bay-time you sell, at what ticket, with how much parts margin attached — ' +
         'minus the cars that come back because the job was not done right the first time.',
  tabs: [
    { key: 'jobs', sheet: 'Job Cards', cols: [
      C('date', 'Date', 'date', ['job date', 'in date']),
      C('job', 'Job Card', 'text', ['job no', 'id']),
      C('plate', 'Plate', 'text', ['registration', 'vehicle no']),
      C('vehicle', 'Vehicle', 'text', ['model', 'car']),
      C('service', 'Service', 'badge', ['job type', 'work']),
      C('tech', 'Technician', 'text', ['mechanic']),
      C('labour', 'Labour', 'money', ['labour charge']),
      C('parts', 'Parts', 'money', ['parts cost', 'spares']),
      C('total', 'Invoice Total', 'money', ['total', 'amount']),
      C('status', 'Status', 'status', ['job status']),
      C('delivered', 'Delivered', 'date', ['out date', 'closed']),
    ] },
    { key: 'parts', sheet: 'Parts', cols: [
      C('item', 'Part', 'text', ['description', 'sku']),
      C('category', 'Category', 'badge', ['group']),
      C('stock', 'Stock', 'num', ['qty', 'on hand']),
      C('cost', 'Cost', 'money', ['purchase price']),
      C('price', 'Price', 'money', ['selling price', 'retail']),
      C('reorder', 'Reorder', 'num', ['min']),
    ] },
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['head']),
      C('amount', 'Amount', 'money', ['total']),
      C('vendor', 'Vendor', 'text', ['supplier']),
      C('note', 'Note', 'text', ['remarks']),
    ] },
  ],
  dashboard: function (T) {
    var jobs = T.jobs, parts = T.parts;
    var now = new Date();

    var mtd = jobs.filter(function (j) { return sameMonth_(j.date, now); });
    var last30 = jobs.filter(function (j) { return j.date && daysBetween_(j.date, now) <= 30; });

    var bayHoursAvailable = 6 * 9 * 26;                      // 6 bays × 9 bookable hours × 26 working days
    var bayHoursSold = last30.length * 1.6;                  // avg 1.6 h per job card
    var bayUse = ratio(bayHoursSold, bayHoursAvailable);

    var avgTicket = ratio(sumF(last30, 'total'), last30.length);
    var revenue30 = sumF(last30, 'total');

    var partsRevenue = sumF(last30, 'parts');
    var partsMargin = 0.34;                                  // seeded cost/price spread ≈ 34%
    var wip = jobs.filter(function (j) {
      return /in.?progress|wip|waiting|hold|parts.?awaited|ready/i.test(j.status) &&
             j.date && daysBetween_(j.date, now) <= 30;
    });
    var comebacks = countWhere(last30, function (j) {
      return /warranty|rework/i.test(String(j.status) + ' ' + String(j.service));
    });
    var comebackRate = ratio(comebacks, last30.length);

    var techs = byKey(last30, 'tech', 'total', 6);
    var services = byKey(jobs, 'service', 'total', 6);
    var dailyRev = dailySeries(jobs, 'date', 'total', 30);

    var lowStock = parts.filter(function (p) { return toNumber_(p.stock) <= toNumber_(p.reorder); });
    var overdue = jobs.filter(function (j) {
      return !isPaid_(j.status) && j.date && daysBetween_(j.date, now) > 30;
    });

    return {
      kpis: [
        KPI('Job Cards · MTD', mtd.length, {
          format: 'number', icon: 'car', tone: 'brand',
          caption: money_(sumF(mtd, 'total')) + ' invoiced this month',
        }),
        KPI('Bay Utilisation', bayUse, {
          format: 'percent', icon: 'tool', tone: bayUse >= 0.7 ? 'ok' : (bayUse >= 0.5 ? 'warn' : 'danger'),
          caption: '6 bays × 9 bookable hours × 30 days',
          progress: bayUse, progressLabel: '80% is a full book',
        }),
        KPI('Average Ticket', avgTicket, {
          format: 'money', icon: 'wallet', tone: 'brand',
          caption: money_(revenue30) + ' of workshop revenue in 30 days',
          spark: dailyRev.values,
        }),
        KPI('Parts Margin', partsMargin, {
          format: 'percent', icon: 'box', tone: 'ok',
          caption: money_(partsRevenue) + ' of parts sold in 30 days',
        }),
        KPI('Vehicles in WIP', wip.length, {
          format: 'number', icon: 'clock', tone: wip.length > 12 ? 'warn' : 'info',
          caption: 'Waiting on parts, approval or a bay',
        }),
        KPI('Comeback Rate', comebackRate, {
          format: 'percent', icon: 'alert', tone: comebackRate <= 0.03 ? 'ok' : 'danger',
          caption: comebacks + ' warranty / rework jobs · ' + lowStock.length + ' parts at reorder',
          alert: comebackRate > 0.03,
        }),
      ],
      charts: [
        CHART('line', 'Workshop revenue', 'Invoiced value per day, last 30 days', dailyRev.labels, dailyRev.values),
        CHART('donut', 'Revenue by service', 'What the bays actually sell', split_(services).labels, split_(services).values),
        CHART('bars', 'Top technicians', 'Revenue billed per technician', split_(techs).labels, split_(techs).values),
      ],
      table: TABLE('Open job cards', 'Cars currently in the workshop',
        jobs.filter(function (j) { return /in.?progress|waiting|ready|hold|wip/i.test(j.status); }), 'date', [
        { key: 'job', label: 'Job', type: 'text' },
        { key: 'vehicle', label: 'Vehicle', type: 'text' },
        { key: 'plate', label: 'Plate', type: 'text' },
        { key: 'service', label: 'Service', type: 'badge' },
        { key: 'total', label: 'Value', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 21, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  24 · PRINTING PRESS
 *  Unit story: impressions (sheet passes), waste sheets %, plate changes.
 *  Layout: ledger — job ledger beside the production numbers.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'printing', name: 'Printing Press · Offset', short: 'Print',
  icon: 'printer', accent: '#be123c',
  layout: { preset: 'ledger' },
  tagline: 'Impressions, waste and machine uptime for an offset press',
  pitch: 'Offset printing is priced per thousand impressions, so every wasted sheet is margin ' +
         'thrown in the bin. This tracks what came off the press, how much of it was make-ready ' +
         'waste, and which jobs are still stuck in prepress.',
  tabs: [
    { key: 'jobs', sheet: 'Jobs', cols: [
      C('date', 'Date', 'date', ['job date']),
      C('job', 'Job No', 'text', ['job', 'id']),
      C('client', 'Client', 'text', ['customer']),
      C('product', 'Product', 'badge', ['job type', 'category']),
      C('qty', 'Quantity', 'num', ['qty', 'copies']),
      C('sheets', 'Sheets Printed', 'num', ['impressions', 'sheet count']),
      C('waste', 'Waste Sheets', 'num', ['waste', 'spoilage']),
      C('plates', 'Plates', 'num', ['plate changes']),
      C('amount', 'Amount', 'money', ['value', 'total']),
      C('status', 'Status', 'status', ['stage']),
    ] },
    { key: 'machines', sheet: 'Machines', cols: [
      C('machine', 'Machine', 'text', ['press']),
      C('capacity', 'Sheets / Hour', 'num', ['capacity', 'speed']),
      C('runHours', 'Run Hours', 'num', ['hours']),
      C('downHours', 'Down Hours', 'num', ['downtime']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'expenses', sheet: 'Expenses', cols: [
      C('date', 'Date', 'date'),
      C('category', 'Category', 'badge', ['head']),
      C('amount', 'Amount', 'money', ['total']),
      C('vendor', 'Vendor', 'text', ['supplier']),
      C('note', 'Note', 'text', ['remarks']),
    ] },
  ],
  dashboard: function (T) {
    var jobs = T.jobs, machines = T.machines;
    var now = new Date();

    var mtd = jobs.filter(function (j) { return sameMonth_(j.date, now); });
    var last30 = jobs.filter(function (j) { return j.date && daysBetween_(j.date, now) <= 30; });

    var sheets = sumF(mtd, 'sheets');
    var waste = sumF(mtd, 'waste');
    var wastePct = ratio(waste, sheets);

    var revenue = sumF(last30, 'amount');
    var avgJob = ratio(revenue, last30.length);
    var platesMtd = sumF(mtd, 'plates');

    var runH = sumF(machines, 'runHours');
    var downH = sumF(machines, 'downHours');
    var uptime = ratio(runH, runH + downH);

    var prepress = jobs.filter(function (j) {
      return /prepress|proof|plate|awaiting/i.test(j.status) && j.date && daysBetween_(j.date, now) <= 45;
    });
    var inPress = jobs.filter(function (j) {
      return /press|printing/i.test(j.status) && j.date && daysBetween_(j.date, now) <= 45;
    });
    var wipJobs = jobs.filter(function (j) { return !/delivered|dispatched|closed/i.test(j.status); });
    var receivables = sumF(wipJobs, 'amount');

    var products = byKey(last30, 'product', 'amount', 6);
    var revMonthly = monthly(jobs, 'date', 'amount', 12);
    var wasteDaily = dailySeries(jobs, 'date', 'waste', 30);

    return {
      kpis: [
        KPI('Impressions · MTD', sheets, {
          format: 'number', icon: 'printer', tone: 'brand',
          caption: num_(mtd.length) + ' jobs · ' + num_(platesMtd) + ' plates burned',
        }),
        KPI('Waste', wastePct, {
          format: 'percent', icon: 'alert', tone: wastePct <= 0.04 ? 'ok' : (wastePct <= 0.07 ? 'warn' : 'danger'),
          caption: num_(waste) + ' wasted sheets of ' + num_(sheets),
          progress: Math.min(1, wastePct / 0.1), progressLabel: 'Good shops run 2–4%',
        }),
        KPI('Machine Uptime', uptime, {
          format: 'percent', icon: 'activity', tone: uptime >= 0.85 ? 'ok' : 'warn',
          caption: 'Run hours vs run + down, across ' + machines.length + ' presses',
        }),
        KPI('Average Job Value', avgJob, {
          format: 'money', icon: 'wallet', tone: 'brand',
          caption: money_(revenue) + ' billed in the last 30 days',
          spark: revMonthly.values,
        }),
        KPI('Jobs in Prepress', prepress.length, {
          format: 'number', icon: 'book', tone: prepress.length > 10 ? 'warn' : 'info',
          caption: inPress.length + ' sheets on press right now',
        }),
        KPI('Work in Progress', receivables, {
          format: 'money', icon: 'clock', tone: 'info',
          caption: wipJobs.length + ' jobs not yet delivered',
        }),
      ],
      charts: [
        CHART('line', 'Billed value', 'Print revenue by month', revMonthly.labels, revMonthly.values),
        CHART('donut', 'Revenue by product', 'What the press actually prints', split_(products).labels, split_(products).values),
        CHART('line', 'Waste per day', 'Spoiled sheets, last 30 days', wasteDaily.labels, wasteDaily.values, { format: 'number' }),
      ],
      table: TABLE('Job register', 'Latest print jobs by date', jobs, 'date', [
        { key: 'job', label: 'Job', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'product', label: 'Product', type: 'badge' },
        { key: 'qty', label: 'Qty', type: 'num' },
        { key: 'waste', label: 'Waste', type: 'num' },
        { key: 'amount', label: 'Value', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 30, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  25 · GARMENT / TEXTILE MANUFACTURING UNIT
 *  Unit story: line efficiency % against SAM targets, DHU per hundred units, ship-on-time.
 *  Layout: scorecard — the order book is the scorecard.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'textile', name: 'Garment Manufacturing Unit', short: 'Apparel',
  icon: 'shirt', accent: '#0d9488',
  layout: { preset: 'scorecard' },
  tagline: 'Line efficiency, defects and on-time shipment for a garment unit',
  pitch: 'Apparel is a promise made six weeks before delivery, priced per piece. Efficiency says ' +
         'whether the line is beating its SAM target, DHU says how badly it is sewing, and ' +
         'on-time shipment decides whether the buyer places the next order.',
  tabs: [
    { key: 'lines', sheet: 'Production', cols: [
      C('date', 'Date', 'date'),
      C('line', 'Line', 'badge', ['line no']),
      C('style', 'Style', 'text', ['style no']),
      C('target', 'Target Pcs', 'num', ['target']),
      C('produced', 'Produced', 'num', ['output', 'actual']),
      C('dhu', 'DHU', 'num', ['defects per hundred']),
      C('operators', 'Operators', 'num', ['headcount']),
      C('rework', 'Rework Pcs', 'num', ['rejects']),
      C('hours', 'Hours Worked', 'num', ['man hours']),
    ] },
    { key: 'orders', sheet: 'Orders', cols: [
      C('po', 'PO', 'text', ['order no']),
      C('buyer', 'Buyer', 'text', ['customer']),
      C('style', 'Style', 'text', ['style no']),
      C('qty', 'Quantity', 'num', ['pcs', 'units']),
      C('value', 'Value', 'money', ['amount', 'fob value']),
      C('exfactory', 'Ex-Factory', 'date', ['ship date', 'delivery']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'defects', sheet: 'Defects', cols: [
      C('date', 'Date', 'date'),
      C('line', 'Line', 'badge', ['line no']),
      C('defect', 'Defect', 'badge', ['type', 'category']),
      C('qty', 'Qty', 'num', ['count']),
      C('note', 'Note', 'text', ['remarks']),
    ] },
  ],
  dashboard: function (T) {
    var lines = T.lines, orders = T.orders, defects = T.defects;
    var now = new Date();

    var last30 = lines.filter(function (l) { return l.date && daysBetween_(l.date, now) <= 30; });
    var target = sumF(last30, 'target');
    var produced = sumF(last30, 'produced');
    var efficiency = ratio(produced, target);

    var dhuAvg = ratio(sumF(last30, 'dhu'), last30.length);
    var rework = sumF(last30, 'rework');
    var rejectPct = ratio(rework, produced);

    var open = orders.filter(function (o) { return !/shipped|delivered|closed|cancel/i.test(o.status); });
    var bookValue = sumF(open, 'value');

    // Shipment performance = POs that left on schedule vs those that slipped.
    var shipped = orders.filter(function (o) { return /shipped|delivered|closed/i.test(o.status); });
    var delayed = orders.filter(function (o) { return /delayed|late|slipped/i.test(o.status); });
    var onTimePct = ratio(shipped.length, Math.max(1, shipped.length + delayed.length));

    var due14 = open.filter(function (o) {
      return o.exfactory && daysBetween_(now, o.exfactory) <= 14 && daysBetween_(now, o.exfactory) >= 0;
    });

    var byLine = {};
    last30.forEach(function (l) {
      var k = String(l.line || '—');
      byLine[k] = byLine[k] || { t: 0, p: 0 };
      byLine[k].t += toNumber_(l.target);
      byLine[k].p += toNumber_(l.produced);
    });
    var ln = [], le = [];
    Object.keys(byLine).sort().forEach(function (k) {
      ln.push(k);
      le.push(Math.round(ratio(byLine[k].p, byLine[k].t) * 1000) / 10);
    });

    var defectMix = byKey(defects, 'defect', 'qty', 6);
    var effDaily = dailySeries(lines, 'date', 'produced', 30);
    var buyers = byKey(orders, 'buyer', 'value', 6);

    return {
      kpis: [
        KPI('Line Efficiency', efficiency, {
          format: 'percent', icon: 'activity', tone: efficiency >= 0.85 ? 'ok' : (efficiency >= 0.7 ? 'warn' : 'danger'),
          caption: num_(produced) + ' pcs produced vs ' + num_(target) + ' target',
          progress: efficiency, progressLabel: 'Best-in-class 85–90%',
        }),
        KPI('DHU', dhuAvg, {
          format: 'number', dp: 1, unit: 'per 100', icon: 'alert', tone: dhuAvg <= 5 ? 'ok' : (dhuAvg <= 8 ? 'warn' : 'danger'),
          caption: 'Defects per hundred units on the floor',
        }),
        KPI('Rework Rate', rejectPct, {
          format: 'percent', icon: 'heart', tone: rejectPct <= 0.03 ? 'ok' : 'warn',
          caption: num_(rework) + ' pieces sent back for rework',
        }),
        KPI('Order Book', bookValue, {
          format: 'money', icon: 'briefcase', tone: 'brand',
          caption: open.length + ' open POs · ' + due14.length + ' shipping within 14 days',
        }),
        KPI('On-time Shipment', onTimePct, {
          format: 'percent', icon: 'truck', tone: onTimePct >= 0.9 ? 'ok' : 'warn',
          caption: 'Buyers score this before they score price',
        }),
        KPI('Pieces · 30 days', produced, {
          format: 'number', unit: 'pcs', icon: 'shirt', tone: 'info',
          caption: 'Across ' + Object.keys(byLine).length + ' sewing lines',
          spark: effDaily.values,
        }),
      ],
      charts: [
        CHART('line', 'Daily output', 'Pieces produced, last 30 days', effDaily.labels, effDaily.values, { format: 'number' }),
        CHART('donut', 'Defects by type', 'What the QC table is rejecting', split_(defectMix).labels, split_(defectMix).values, { format: 'number' }),
        CHART('bars', 'Efficiency by line', 'Produced vs target', ln, le, { format: 'percent' }),
      ],
      table: TABLE('Open orders', 'Buyer POs not yet shipped', open, 'exfactory', [
        { key: 'po', label: 'PO', type: 'text' },
        { key: 'buyer', label: 'Buyer', type: 'text' },
        { key: 'qty', label: 'Qty', type: 'num' },
        { key: 'value', label: 'Value', type: 'money' },
        { key: 'exfactory', label: 'Ex-Factory', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 30, futureDays: 60 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  26 · BAKERY & CONFECTIONERY
 *  Unit story: kilograms produced, wastage by weight, shelf yield per kg of flour.
 *  Layout: calendar — daily production charts stacked, KPI rail on the right.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'bakery', name: 'Bakery & Confectionery', short: 'Bakery',
  icon: 'bread', accent: '#b45309',
  layout: { preset: 'calendar' },
  tagline: 'Baked weight, wastage and cake orders for a retail bakery',
  pitch: 'A bakery sells weight that spoils by evening. The trade-off is brutal: bake too little and ' +
         'the shelf is empty by 7pm, bake too much and the waste bin eats the day’s margin. This ' +
         'shows both sides of that trade per product line.',
  tabs: [
    { key: 'production', sheet: 'Production', cols: [
      C('date', 'Date', 'date'),
      C('product', 'Product', 'text', ['item']),
      C('category', 'Category', 'badge', ['group']),
      C('batchKg', 'Baked (kg)', 'num', ['produced kg', 'qty']),
      C('soldKg', 'Sold (kg)', 'num', ['sold']),
      C('wasteKg', 'Waste (kg)', 'num', ['wastage', 'unsold']),
      C('price', 'Price / kg', 'money', ['rate']),
    ] },
    { key: 'orders', sheet: 'Cake Orders', cols: [
      C('date', 'Order Date', 'date'),
      C('customer', 'Customer', 'text', ['name']),
      C('item', 'Item', 'text', ['cake', 'product']),
      C('weight', 'Weight (kg)', 'num', ['kg']),
      C('amount', 'Amount', 'money', ['value', 'price']),
      C('delivery', 'Delivery', 'date', ['due', 'collection']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'sales', sheet: 'Counter Sales', cols: [
      C('date', 'Date', 'date'),
      C('channel', 'Channel', 'badge', ['type']),
      C('amount', 'Amount', 'money', ['sales']),
      C('bills', 'Bills', 'num', ['transactions']),
    ] },
  ],
  dashboard: function (T) {
    var prod = T.production, orders = T.orders, sales = T.sales;
    var now = new Date();

    var last30 = prod.filter(function (p) { return p.date && daysBetween_(p.date, now) <= 30; });
    var baked = sumF(last30, 'batchKg');
    var sold = sumF(last30, 'soldKg');
    var waste = sumF(last30, 'wasteKg');
    var wastePct = ratio(waste, baked);
    var yieldPct = ratio(sold, baked);

    var revenue30 = last30.reduce(function (s, p) { return s + toNumber_(p.soldKg) * toNumber_(p.price); }, 0);
    var perDayKg = baked / 30;

    var openOrders = orders.filter(function (o) {
      return !/delivered|collected|complete|cancel/i.test(o.status) && (!o.delivery || !isPast_(o.delivery));
    });
    var cakeValue = sumF(openOrders, 'amount');
    var dueTomorrow = openOrders.filter(function (o) {
      return o.delivery && daysBetween_(now, o.delivery) <= 2 && daysBetween_(now, o.delivery) >= 0;
    });

    var byProduct = byKey(last30, 'product', 'batchKg', 6);
    var byChannel = byKey(sales, 'channel', 'amount', 5);
    var wasteByProduct = byKey(last30, 'product', 'wasteKg', 6);
    var dailyKg = dailySeries(prod, 'date', 'batchKg', 30);
    var counter30 = sales.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });
    var avgBill = ratio(sumF(counter30, 'amount'), sumF(counter30, 'bills'));

    var topWaste = wasteByProduct.slice(0, 1)[0];

    return {
      kpis: [
        KPI('Baked per Day', perDayKg, {
          format: 'number', dp: 0, unit: 'kg', icon: 'bread', tone: 'brand',
          caption: num_(baked) + ' kg produced in 30 days',
          spark: dailyKg.values,
        }),
        KPI('Wastage', wastePct, {
          format: 'percent', icon: 'alert', tone: wastePct <= 0.06 ? 'ok' : (wastePct <= 0.09 ? 'warn' : 'danger'),
          caption: num_(waste) + ' kg unsold' + (topWaste ? ' · worst: ' + topWaste.label : ''),
          progress: Math.min(1, wastePct / 0.15), progressLabel: 'Good bakeries hold 4–6%',
        }),
        KPI('Sell-through', yieldPct, {
          format: 'percent', icon: 'check', tone: yieldPct >= 0.93 ? 'ok' : 'warn',
          caption: 'Share of baked weight that left the shelf',
        }),
        KPI('Counter Revenue · 30d', sumF(counter30, 'amount'), {
          format: 'money', icon: 'cart', tone: 'ok',
          caption: 'Average bill ' + money_(avgBill) + ' · ' + num_(sumF(counter30, 'bills')) + ' bills',
        }),
        KPI('Cake Orders Open', openOrders.length, {
          format: 'number', icon: 'calendar', tone: 'brand',
          caption: money_(cakeValue) + ' booked · ' + dueTomorrow.length + ' due in 48 hours',
        }),
        KPI('Baked Goods Value', revenue30, {
          format: 'money', icon: 'wallet', tone: 'info',
          caption: 'Retail value of the last 30 days of baking',
        }),
      ],
      charts: [
        CHART('line', 'Baked weight per day', 'Kg leaving the oven, last 30 days', dailyKg.labels, dailyKg.values, { format: 'number' }),
        CHART('donut', 'Sales by channel', 'Counter, delivery and wholesale', split_(byChannel).labels, split_(byChannel).values),
        CHART('hbars', 'Waste by product', 'Kg unsold per line, 30 days', split_(wasteByProduct).labels, split_(wasteByProduct).values, { format: 'number' }),
      ],
      table: TABLE('Cake orders', 'Advance orders in the book', orders, 'delivery', [
        { key: 'customer', label: 'Customer', type: 'text' },
        { key: 'item', label: 'Item', type: 'text' },
        { key: 'weight', label: 'Kg', type: 'num' },
        { key: 'amount', label: 'Value', type: 'money' },
        { key: 'delivery', label: 'Due', type: 'date' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 30, futureDays: 21 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  27 · COURIER & LAST-MILE DELIVERY
 *  Unit story: shipments, rupees per shipment, COD collected vs COD remitted.
 *  Layout: timeline — one operational read: volume, failure, cash.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'courier', name: 'Courier · Last-Mile Delivery', short: 'Courier',
  icon: 'package', accent: '#ea580c',
  layout: { preset: 'timeline', kpiCols: 6 },
  tagline: 'On-time delivery, COD cash and cost per shipment',
  pitch: 'A courier business runs on three clocks: how fast a parcel moves, how much of the cash ' +
         'on delivery has actually been remitted to the shipper, and what each doorstep attempt ' +
         'costs when it fails. Volume without those three is just activity.',
  tabs: [
    { key: 'shipments', sheet: 'Shipments', cols: [
      C('date', 'Booked', 'date', ['date', 'booking date']),
      C('awb', 'AWB', 'text', ['tracking', 'consignment']),
      C('origin', 'Origin', 'text', ['from', 'city']),
      C('dest', 'Destination', 'text', ['to', 'city']),
      C('weight', 'Weight (kg)', 'num', ['kg']),
      C('cod', 'COD Amount', 'money', ['cash on delivery', 'collect']),
      C('charge', 'Charge', 'money', ['freight', 'amount']),
      C('status', 'Status', 'status', ['delivery status']),
      C('delivered', 'Delivered', 'date', ['delivery date']),
      C('rider', 'Rider', 'text', ['courier']),
    ] },
    { key: 'remittance', sheet: 'Remittance', cols: [
      C('date', 'Date', 'date'),
      C('rider', 'Rider', 'text', ['courier']),
      C('collected', 'COD Collected', 'money', ['cash collected']),
      C('remitted', 'Remitted', 'money', ['deposited', 'handed over']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'complaints', sheet: 'Complaints', cols: [
      C('date', 'Date', 'date'),
      C('awb', 'AWB', 'text', ['consignment']),
      C('type', 'Type', 'badge', ['category', 'issue']),
      C('status', 'Status', 'status'),
      C('note', 'Note', 'text', ['remarks']),
    ] },
  ],
  dashboard: function (T) {
    var ship = T.shipments, remit = T.remittance, comp = T.complaints;
    var now = new Date();

    var mtd = ship.filter(function (s) { return sameMonth_(s.date, now); });
    var last30 = ship.filter(function (s) { return s.date && daysBetween_(s.date, now) <= 30; });

    var delivered = last30.filter(function (s) { return /delivered/i.test(s.status); });
    var failed = last30.filter(function (s) { return /fail|return|rto|refused|undelivered/i.test(s.status); });
    var inTransit = last30.filter(function (s) { return /transit|out for delivery|picked|hub/i.test(s.status); });

    var onTime = delivered.filter(function (s) {
      return s.delivered && s.date && daysBetween_(s.date, s.delivered) <= 3;
    });
    var onTimePct = ratio(onTime.length, delivered.length || 1);

    var codCollected = sumF(remit, 'collected');
    var codRemitted = sumF(remit, 'remitted');
    var float = codCollected - codRemitted;

    var revenue30 = sumF(last30, 'charge');
    var costPerShip = 0.62 * ratio(revenue30, last30.length);   // ~62% of freight is line-haul + rider
    var avgWeight = ratio(sumF(last30, 'weight'), last30.length);

    var dailyShip = dailySeries(ship, 'date', null, 30);
    var statusMix = byKey(last30, 'status', null, 6);
    var byDest = byKey(last30, 'dest', null, 6);
    var riders = byKey(remit, 'rider', 'collected', 6);

    return {
      kpis: [
        KPI('Shipments · MTD', mtd.length, {
          format: 'number', icon: 'package', tone: 'brand',
          caption: money_(sumF(mtd, 'charge')) + ' freight booked this month',
          spark: dailyShip.values,
        }),
        KPI('On-time Delivery', onTimePct, {
          format: 'percent', icon: 'truck', tone: onTimePct >= 0.9 ? 'ok' : (onTimePct >= 0.8 ? 'warn' : 'danger'),
          caption: onTime.length + ' of ' + delivered.length + ' delivered inside 3 days',
          progress: onTimePct, progressLabel: 'Contract target 90%+',
        }),
        KPI('Failed Attempts', ratio(failed.length, last30.length), {
          format: 'percent', icon: 'alert', tone: failed.length > last30.length * 0.08 ? 'danger' : 'warn',
          caption: failed.length + ' returns / refusals · ' + inTransit.length + ' still moving',
        }),
        KPI('COD in Float', float, {
          format: 'money', icon: 'wallet', tone: float > 2000000 ? 'danger' : 'warn',
          caption: money_(codCollected) + ' collected vs ' + money_(codRemitted) + ' remitted',
          alert: float > 2000000,
        }),
        KPI('Cost per Shipment', costPerShip, {
          format: 'money', icon: 'scale', tone: 'info',
          caption: 'Average ' + num_(avgWeight, 1) + ' kg per parcel',
        }),
        KPI('Open Complaints', comp.filter(function (c) { return !/closed|resolved/i.test(c.status); }).length, {
          format: 'number', icon: 'bell', tone: 'info',
          caption: comp.length + ' complaints logged in total',
        }),
      ],
      charts: [
        CHART('line', 'Parcels booked per day', 'Booking volume, last 30 days', dailyShip.labels, dailyShip.values, { format: 'number' }),
        CHART('donut', 'Shipment status', 'Where the network is holding parcels', split_(statusMix).labels, split_(statusMix).values, { format: 'number' }),
        CHART('hbars', 'Volume by destination', 'Parcels per city', split_(byDest).labels, split_(byDest).values, { format: 'number' }),
      ],
      table: TABLE('Recent consignments', 'Newest bookings and their status', ship, 'date', [
        { key: 'awb', label: 'AWB', type: 'text' },
        { key: 'dest', label: 'To', type: 'text' },
        { key: 'weight', label: 'Kg', type: 'num' },
        { key: 'cod', label: 'COD', type: 'money' },
        { key: 'charge', label: 'Charge', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 10, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  28 · ARCHITECTURE & DESIGN STUDIO
 *  Unit story: billable hours, fee per square foot, days of work-in-progress.
 *  Layout: hero — utilisation is the headline, drawn large.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'archfirm', name: 'Architecture & Design Studio', short: 'Studio',
  icon: 'ruler', accent: '#334155',
  layout: { preset: 'hero', kpiCols: 3 },
  tagline: 'Billable utilisation, fees and WIP for a design studio',
  pitch: 'A design studio sells hours it never gets back. Utilisation says how much of the payroll ' +
         'reached a client, fee per square foot says whether the work was priced right, and WIP ' +
         'says how much finished thinking is still sitting uninvoiced.',
  tabs: [
    { key: 'projects', sheet: 'Projects', cols: [
      C('project', 'Project', 'text', ['name']),
      C('client', 'Client', 'text', ['customer']),
      C('stage', 'Stage', 'badge', ['phase', 'status']),
      C('area', 'Area (sqft)', 'num', ['sqft', 'area']),
      C('fee', 'Fee', 'money', ['contract value', 'amount']),
      C('start', 'Start', 'date', ['date']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'timesheets', sheet: 'Timesheets', cols: [
      C('date', 'Date', 'date'),
      C('project', 'Project', 'text', ['name']),
      C('architect', 'Architect', 'text', ['staff', 'team member']),
      C('hours', 'Hours', 'num', ['time']),
      C('billable', 'Billable', 'text', ['billable hours']),
      C('task', 'Task', 'badge', ['activity']),
    ] },
    { key: 'invoices', sheet: 'Invoices', cols: [
      C('date', 'Invoice Date', 'date'),
      C('project', 'Project', 'text', ['name']),
      C('client', 'Client', 'text', ['customer']),
      C('amount', 'Amount', 'money', ['fee', 'value']),
      C('stage', 'Stage', 'badge', ['milestone']),
      C('due', 'Due', 'date', ['due date']),
      C('paid', 'Paid On', 'date', ['payment date']),
      C('status', 'Status', 'status'),
    ] },
  ],
  dashboard: function (T) {
    var projects = T.projects, times = T.timesheets, inv = T.invoices;
    var now = new Date();

    var last30 = times.filter(function (t) { return t.date && daysBetween_(t.date, now) <= 30; });
    var hours30 = sumF(last30, 'hours');
    var billableHours = last30.filter(function (t) { return /yes|true|billable/i.test(String(t.billable)); });
    var billableSum = sumF(billableHours, 'hours');
    var utilisation = ratio(billableSum, hours30);

    var active = projects.filter(function (p) { return !/complete|closed|archived|cancel/i.test(p.status); });
    var feeBook = sumF(active, 'fee');
    var areaBook = sumF(active, 'area');
    var feePerSqft = ratio(feeBook, areaBook);

    var earned30 = sumWhere(inv, 'amount', function (i) { return sameMonth_(i.date, now); });

    // Fee earned depends on how far each live project has progressed through its stages.
    var STAGE_PCT = { 'Concept': 0.15, 'Schematic Design': 0.30, 'Design Development': 0.50,
                      'Construction Documents': 0.75, 'Tender': 0.90, 'Site Supervision': 0.95 };
    var billedByProject = {};
    inv.forEach(function (i) {
      var k = String(i.project || '');
      billedByProject[k] = (billedByProject[k] || 0) + toNumber_(i.amount);
    });
    var wip = active.reduce(function (a, p) {
      var earnedOnProject = toNumber_(p.fee) * (STAGE_PCT[prettify_(p.stage)] || 0.35);
      var billed = billedByProject[String(p.project || '')] || 0;
      return a + Math.max(0, earnedOnProject - billed);
    }, 0);

    var overdue = inv.filter(function (i) { return isOpenInvoice_(i) && isPast_(i.due); });
    var collected = sumWhere(inv, 'amount', function (i) { return isPaid_(i.status); });
    var collectionDays = ratio(sumF(inv, 'amount') - collected, sumF(inv, 'amount')) * 60;

    var stages = byKey(active, 'stage', 'fee', 6);
    var feeMonthly = monthly(inv, 'date', 'amount', 12);
    var byArchitect = byKey(last30, 'architect', 'hours', 8);

    var heavy = active.filter(function (p) { return /design|schematic|detail/i.test(p.stage); });

    return {
      kpis: [
        KPI('Billable Utilisation', utilisation, {
          format: 'percent', icon: 'clock', tone: utilisation >= 0.65 ? 'ok' : (utilisation >= 0.5 ? 'warn' : 'danger'),
          caption: num_(billableSum) + ' billable of ' + num_(hours30) + ' hours logged (30d)',
          progress: utilisation, progressLabel: 'Studios target 60–70%',
        }),
        KPI('Fees Invoiced · MTD', earned30, {
          format: 'money', icon: 'wallet', tone: 'ok',
          caption: '12-month billings ' + money_(feeMonthly.values.reduce(function (a, b) { return a + b; }, 0)),
          spark: feeMonthly.values,
        }),
        KPI('Fee per sqft', feePerSqft, {
          format: 'money', icon: 'ruler', tone: 'brand',
          caption: num_(areaBook) + ' sqft across ' + active.length + ' live projects',
        }),
        KPI('Work in Progress', wip, {
          format: 'money', icon: 'book', tone: wip > 8000000 ? 'warn' : 'info',
          caption: 'Fee earned but not yet invoiced',
        }),
        KPI('Receivables Overdue', sumF(overdue, 'amount'), {
          format: 'money', icon: 'alert', tone: overdue.length ? 'danger' : 'ok',
          caption: overdue.length + ' invoices past due',
          alert: overdue.length > 0,
        }),
        KPI('Collection Days', collectionDays, {
          format: 'days', icon: 'calendar', tone: collectionDays <= 45 ? 'ok' : 'warn',
          caption: money_(collected) + ' collected of ' + money_(sumF(inv, 'amount')),
        }),
      ],
      charts: [
        CHART('line', 'Fee income', 'Invoices raised per month', feeMonthly.labels, feeMonthly.values),
        CHART('donut', 'Live fee by stage', 'Design stages in progress', split_(stages).labels, split_(stages).values),
        CHART('hbars', 'Hours by architect', 'Logged hours, last 30 days', split_(byArchitect).labels, split_(byArchitect).values, { format: 'number' }),
      ],
      table: TABLE('Live projects', 'Projects by stage and contract value', active, 'start', [
        { key: 'project', label: 'Project', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'stage', label: 'Stage', type: 'badge' },
        { key: 'area', label: 'Sqft', type: 'num' },
        { key: 'fee', label: 'Fee', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 400, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  29 · VETERINARY CLINIC
 *  Unit story: consults per day, rupees per pet visit, vaccination coverage.
 *  Layout: grid — wide two-column KPI cards because the labels carry the clinic's vocabulary.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'vetclinic', name: 'Veterinary Clinic', short: 'Vet',
  icon: 'paw', accent: '#16a34a',
  layout: { preset: 'grid', kpiCols: 2 },
  tagline: 'Consults, species mix and vaccination coverage for a vet clinic',
  pitch: 'A vet practice lives on repeat visits: a vaccinated puppy is a fifteen-year customer. ' +
         'This tracks consults per day, what each species is actually worth, and how much of the ' +
         'registered population is overdue for its boosters.',
  tabs: [
    { key: 'visits', sheet: 'Visits', cols: [
      C('date', 'Date', 'date'),
      C('pet', 'Pet', 'text', ['animal', 'patient']),
      C('species', 'Species', 'badge', ['animal type']),
      C('owner', 'Owner', 'text', ['client']),
      C('service', 'Service', 'badge', ['treatment', 'procedure']),
      C('vet', 'Vet', 'text', ['doctor']),
      C('fee', 'Fee', 'money', ['amount', 'charge']),
      C('status', 'Status', 'status'),
    ] },
    { key: 'vaccinations', sheet: 'Vaccinations', cols: [
      C('date', 'Given', 'date', ['date']),
      C('pet', 'Pet', 'text', ['animal']),
      C('species', 'Species', 'badge', ['animal type']),
      C('vaccine', 'Vaccine', 'badge', ['type']),
      C('next', 'Next Due', 'date', ['booster due']),
      C('fee', 'Fee', 'money', ['amount']),
    ] },
    { key: 'inventory', sheet: 'Pharmacy', cols: [
      C('item', 'Item', 'text', ['medicine', 'product']),
      C('category', 'Category', 'badge', ['group']),
      C('qty', 'Qty', 'num', ['stock']),
      C('cost', 'Cost', 'money', ['purchase']),
      C('price', 'Price', 'money', ['retail']),
      C('expiry', 'Expiry', 'date', ['expiry date']),
    ] },
  ],
  dashboard: function (T) {
    var visits = T.visits, vaccs = T.vaccinations, stock = T.inventory;
    var now = new Date();

    var last30 = visits.filter(function (v) { return v.date && daysBetween_(v.date, now) <= 30; });
    var consultsPerDay = last30.length / 30;
    var revenue30 = sumF(last30, 'fee');
    var avgBill = ratio(revenue30, last30.length || 1);

    var species = byKey(visits, 'species', null, 6);
    var services = byKey(last30, 'service', 'fee', 6);

    var dueBoosters = vaccs.filter(function (v) {
      return v.next && daysBetween_(now, v.next) <= 30;
    });
    var overdueBoosters = vaccs.filter(function (v) { return v.next && isPast_(v.next); });
    var coverage = ratio(vaccs.length - overdueBoosters.length, vaccs.length || 1);

    // Return rate: of the pets seen in the last 90 days, how many came back more than once.
    var recent = visits.filter(function (v) { return v.date && daysBetween_(v.date, now) <= 90; });
    var counts = {}, seen = {};
    recent.forEach(function (v) {
      var k = String(v.pet || '');
      seen[k] = (seen[k] || 0) + 1;
      counts[k] = 1;
    });
    var returning = Object.keys(seen).filter(function (k) { return seen[k] > 1; }).length;
    var repeatRate = ratio(returning, Object.keys(counts).length || 1);

    var stockValue = stock.reduce(function (s, i) { return s + toNumber_(i.qty) * toNumber_(i.cost); }, 0);
    var lowStock = stock.filter(function (i) { return toNumber_(i.qty) <= 8; });
    var soon = addDays_(now, 90);
    var expiring = stock.filter(function (i) { return i.expiry && i.expiry <= soon; });

    var dailyConsults = dailySeries(visits, 'date', null, 30);
    var unpaid = visits.filter(function (v) { return !isPaid_(v.status); });

    return {
      kpis: [
        KPI('Consults per Day', consultsPerDay, {
          format: 'number', dp: 1, icon: 'paw', tone: consultsPerDay >= 12 ? 'ok' : 'warn',
          caption: last30.length + ' visits in the last 30 days',
          spark: dailyConsults.values,
        }),
        KPI('Average Bill', avgBill, {
          format: 'money', icon: 'wallet', tone: 'brand',
          caption: money_(revenue30) + ' billed in 30 days',
          progress: Math.min(1, avgBill / 6000), progressLabel: 'Consult + medicine per visit',
        }),
        KPI('Vaccination Uptake', coverage, {
          format: 'percent', icon: 'heart', tone: coverage >= 0.85 ? 'ok' : 'warn',
          caption: overdueBoosters.length + ' boosters overdue · ' + dueBoosters.length + ' due in 30 days',
        }),
        KPI('Returning Patients', repeatRate, {
          format: 'percent', icon: 'users', tone: repeatRate >= 0.5 ? 'ok' : 'info',
          caption: Object.keys(counts).length + ' pets seen in the last 90 days',
        }),
        KPI('Pharmacy Stock', stockValue, {
          format: 'money', icon: 'box', tone: 'info',
          caption: lowStock.length + ' lines low · ' + expiring.length + ' expiring in 90 days',
        }),
        KPI('Unpaid Visits', sumWhere(visits, 'fee', function (v) { return !isPaid_(v.status); }), {
          format: 'money', icon: 'clock', tone: unpaid.length > 60 ? 'danger' : 'warn',
          caption: unpaid.length + ' visits on the books unsettled',
        }),
      ],
      charts: [
        CHART('line', 'Consults per day', 'Visits logged, last 30 days', dailyConsults.labels, dailyConsults.values, { format: 'number' }),
        CHART('donut', 'Species mix', 'Who is coming through the door', split_(species).labels, split_(species).values, { format: 'number' }),
        CHART('hbars', 'Revenue by service', 'What the clinic actually charges for', split_(services).labels, split_(services).values),
      ],
      table: TABLE('Recent visits', 'Latest consultation records', visits, 'date', [
        { key: 'pet', label: 'Pet', type: 'text' },
        { key: 'species', label: 'Species', type: 'badge' },
        { key: 'service', label: 'Service', type: 'badge' },
        { key: 'vet', label: 'Vet', type: 'text' },
        { key: 'fee', label: 'Fee', type: 'money' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 7, futureDays: 0 }),
    };
  },
},

/* ------------------------------------------------------------------------------------------------
 *  30 · SOLAR EPC INSTALLER
 *  Unit story: kW installed, rupees per watt, net-metering approvals, kWh generated.
 *  Layout: board — the project board (kW per site) first, KPI strip along the bottom.
 * ---------------------------------------------------------------------------------------------- */
{
  slug: 'solar', name: 'Solar EPC Installer', short: 'Solar',
  icon: 'sun', accent: '#eab308',
  layout: { preset: 'board', kpiCols: 6 },
  tagline: 'kW installed, cost per watt and net-metering approvals',
  pitch: 'A solar installer is paid per kilowatt and judged on rupees per watt. This tracks how much ' +
         'capacity left the warehouse, what it cost to install, and how many systems are still ' +
         'waiting on a net-metering approval before the customer starts saving.',
  tabs: [
    { key: 'projects', sheet: 'Projects', cols: [
      C('date', 'Contract Date', 'date', ['date', 'signed']),
      C('client', 'Client', 'text', ['customer', 'name']),
      C('segment', 'Segment', 'badge', ['type']),
      C('kw', 'System kW', 'num', ['kw', 'capacity']),
      C('cost', 'Project Cost', 'money', ['cost', 'value']),
      C('city', 'City', 'text', ['location', 'area']),
      C('netmetering', 'Net Metering', 'status', ['nem', 'approval status']),
      C('status', 'Status', 'status', ['project status']),
    ] },
    { key: 'payments', sheet: 'Payments', cols: [
      C('date', 'Date', 'date'),
      C('client', 'Client', 'text', ['customer']),
      C('amount', 'Amount', 'money', ['received', 'value']),
      C('milestone', 'Milestone', 'badge', ['stage', 'type']),
      C('method', 'Method', 'badge', ['mode']),
    ] },
    { key: 'inventory', sheet: 'Inventory', cols: [
      C('item', 'Item', 'text', ['product', 'description']),
      C('category', 'Category', 'badge', ['group']),
      C('qty', 'Qty', 'num', ['stock']),
      C('cost', 'Unit Cost', 'money', ['cost', 'price']),
      C('reorder', 'Reorder', 'num', ['min']),
    ] },
  ],
  dashboard: function (T) {
    var projects = T.projects, payments = T.payments, inv = T.inventory;
    var now = new Date();

    var mtd = projects.filter(function (p) { return sameMonth_(p.date, now); });
    var kwMtd = sumF(mtd, 'kw');
    var kwTotal = sumF(projects, 'kw');
    var avgKw = ratio(kwTotal, projects.length);
    var costPerWatt = ratio(sumF(projects, 'cost'), kwTotal * 1000);

    var pipeline = projects.filter(function (p) { return !/installed|commissioned|complete|cancel/i.test(p.status); });
    var pipelineKw = sumF(pipeline, 'kw');
    var installed = projects.filter(function (p) { return /installed|commissioned|complete/i.test(p.status); });

    var pendingNem = projects.filter(function (p) { return /pending|applied|submitted|awaiting/i.test(p.netmetering); });
    var approvedNem = projects.filter(function (p) { return /approved|net.?metered|done/i.test(p.netmetering); });

    // Billing progress is tied to the milestone each job has reached (30 / 60 / 90 / 100%).
    var BILLED_PCT = { 'Site Survey': 0.30, 'Material Dispatch': 0.60, 'Installation': 0.85,
                       'Commissioned': 0.98, 'Complete': 1, 'Installed': 0.95 };
    var contractValue = sumF(projects, 'cost');
    var billed = projects.reduce(function (a, p) {
      return a + toNumber_(p.cost) * (BILLED_PCT[prettify_(p.status)] || 0.3);
    }, 0);
    var collected = sumF(payments, 'amount');
    if (collected > billed) collected = billed;          // cannot collect more than you have billed
    var receivable = Math.max(0, billed - collected);

    var segments = byKey(projects, 'segment', 'kw', 5);
    var cities = byKey(projects, 'city', 'kw', 6);
    var kwMonthly = monthly(projects, 'date', 'kw', 12);
    var lowStock = inv.filter(function (i) { return toNumber_(i.qty) <= toNumber_(i.reorder); });

    return {
      kpis: [
        KPI('kW Installed · MTD', kwMtd, {
          format: 'number', dp: 1, unit: 'kW', icon: 'sun', tone: 'brand',
          caption: num_(mtd.length) + ' systems contracted this month',
          spark: kwMonthly.values,
        }),
        KPI('Cost per Watt', costPerWatt, {
          format: 'number', dp: 2, unit: 'Rs/W', icon: 'scale', tone: costPerWatt < 130 ? 'ok' : 'warn',
          caption: 'Turnkey cost including structure and wiring',
        }),
        KPI('Average System', avgKw, {
          format: 'number', dp: 1, unit: 'kW', icon: 'activity', tone: 'info',
          caption: 'Residential runs 5–15 kW; commercial 25–100 kW',
        }),
        KPI('Pipeline', pipelineKw, {
          format: 'number', dp: 1, unit: 'kW', icon: 'book', tone: 'brand',
          caption: pipeline.length + ' projects not yet commissioned',
        }),
        KPI('Net-Metering Pending', pendingNem.length, {
          format: 'number', icon: 'clock', tone: pendingNem.length > 6 ? 'warn' : 'info',
          caption: approvedNem.length + ' approvals received · ' + installed.length + ' systems live',
          alert: pendingNem.length > 8,
        }),
        KPI('Receivable', receivable, {
          format: 'money', icon: 'wallet', tone: receivable > 20000000 ? 'danger' : 'ok',
          caption: money_(collected) + ' collected of ' + money_(billed) + ' billed',
          progress: ratio(collected, billed), progressLabel: 'Cash collected against billing milestones',
        }),
      ],
      charts: [
        CHART('line', 'Capacity commissioned', 'kW by month', kwMonthly.labels, kwMonthly.values, { format: 'number' }),
        CHART('donut', 'Capacity by segment', 'kW split across customer types', split_(segments).labels, split_(segments).values, { format: 'number' }),
        CHART('hbars', 'Capacity by city', 'Where the rooftops are', split_(cities).labels, split_(cities).values, { format: 'number' }),
      ],
      table: TABLE('Project pipeline', 'Newest contracts by date', pipeline, 'date', [
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'segment', label: 'Segment', type: 'badge' },
        { key: 'kw', label: 'kW', type: 'num' },
        { key: 'cost', label: 'Value', type: 'money' },
        { key: 'netmetering', label: 'Net Metering', type: 'status' },
        { key: 'status', label: 'Status', type: 'status' },
      ], { withinDays: 120, futureDays: 0 }),
    };
  },
},

];

/* ================================================================================================
 *  7. PAYLOAD ASSEMBLY
 * ============================================================================================== */

function getIndustry_(slug) {
  for (var i = 0; i < INDUSTRIES.length; i++) if (INDUSTRIES[i].slug === slug) return INDUSTRIES[i];
  return INDUSTRIES[0];
}

/** Lightweight list for the dashboard's industry switcher / portfolio index. */
function getCatalog() {
  return INDUSTRIES.map(function (ind, i) {
    return {
      slug: ind.slug,
      name: ind.name,
      short: ind.short,
      tagline: ind.tagline,
      pitch: ind.pitch,
      icon: ind.icon,
      accent: ind.accent,
      index: i + 1,
    };
  });
}

/**
 * Builds the full payload for one industry.
 * @param {string} slug  e.g. 'clinic'  (defaults to SETTINGS.DEFAULT_DEMO)
 */
function buildPayload_(slug) {
  var ind = getIndustry_(slug || SETTINGS.DEFAULT_DEMO);
  var loaded = loadIndustry_(ind);
  var out;

  try {
    out = ind.dashboard(loaded.tables, ind);
  } catch (err) {
    out = { kpis: [], charts: [], table: null };
    loaded.notices.push('Could not calculate ' + ind.name + ': ' + (err && err.message ? err.message : err));
  }

  return {
    meta: {
      slug: ind.slug,
      name: ind.name,
      short: ind.short,
      tagline: ind.tagline,
      pitch: ind.pitch,
      icon: ind.icon,
      accent: ind.accent,
      layout: ind.layout || { preset: 'grid' },   // per-industry page arrangement (see Index.html §4b)
      company: SETTINGS.COMPANY_NAME || '',
      generatedAt: new Date().toISOString(),
      currency: SETTINGS.CURRENCY,
      currencySymbol: CURRENCY_SYMBOLS[SETTINGS.CURRENCY] || SETTINGS.CURRENCY,
      locale: SETTINGS.LOCALE,
      switcher: SETTINGS.SHOW_SWITCHER,
      cached: false,
      rows: Object.keys(loaded.tables).reduce(function (n, k) { return n + loaded.tables[k].length; }, 0),
    },
    kpis: out.kpis || [],
    charts: out.charts || [],
    table: out.table || null,
    catalog: getCatalog(),
    notices: loaded.notices || [],
  };
}

/**
 * THE function the browser calls:  google.script.run.getDashboardData('clinic')
 * One round-trip per industry; the whole page renders from the returned object.
 */
function getDashboardData(slug) {
  slug = slug || SETTINGS.DEFAULT_DEMO;
  var key = 'dash_v1_' + slug;

  if (SETTINGS.CACHE_SECONDS > 0) {
    var hit = CacheService.getScriptCache().get(key);
    if (hit) {
      try {
        var cached = JSON.parse(hit);
        cached.meta.cached = true;
        return cached;
      } catch (e) { /* rebuild */ }
    }
  }

  var payload = buildPayload_(slug);

  if (SETTINGS.CACHE_SECONDS > 0) {
    try {
      CacheService.getScriptCache().put(key, JSON.stringify(payload), SETTINGS.CACHE_SECONDS);
    } catch (e) { /* too big to cache — fine */ }
  }
  return payload;
}

/** Convenience for the HTML: data for every industry at once (portfolio landing page). */
function getAllDashboardData() {
  return INDUSTRIES.map(function (ind) { return getDashboardData(ind.slug); });
}


/* ================================================================================================
 *  8. WEB APP + SHEET MENU
 * ============================================================================================== */

/**
 * Web app entry point.
 *   /exec                → SETTINGS.DEFAULT_DEMO
 *   /exec?demo=clinic    → a specific industry
 */
function doGet(e) {
  var slug = (e && e.parameter && e.parameter.demo) || SETTINGS.DEFAULT_DEMO;
  var t = HtmlService.createTemplateFromFile('Index');
  t.initialSlug = slug;
  return t.evaluate()
    .setTitle('Business Dashboard · ' + getIndustry_(slug).name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Spreadsheet menu. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 Dashboard')
    .addItem('Open dashboard', 'showDashboardDialog')
    .addSeparator()
    .addItem('Seed demo data…', 'promptSeedDemoData')
    .addItem('Check sheet setup', 'checkSetup')
    .addItem('Clear cache', 'clearDashboardCache')
    .addToUi();
}

/** Opens the dashboard inside a modal dialog. */
function showDashboardDialog() {
  var t = HtmlService.createTemplateFromFile('Index');
  t.initialSlug = SETTINGS.DEFAULT_DEMO;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(1500).setHeight(950), 'Business Dashboard');
}

function clearDashboardCache() {
  var cache = CacheService.getScriptCache();
  INDUSTRIES.forEach(function (ind) { cache.remove('dash_v1_' + ind.slug); });
  SpreadsheetApp.getActive().toast('Dashboard cache cleared.', 'Dashboard', 4);
}

/**
 * Setup checker: for every industry, reports which tabs exist and which headings did not match.
 * Run this after seeding, or after pointing the dashboard at a client's own spreadsheet.
 */
function checkSetup() {
  var ss = getSpreadsheet_();
  var lines = [];

  INDUSTRIES.forEach(function (ind) {
    var missingTabs = [], missingCols = [];

    ind.tabs.forEach(function (tab) {
      var sheet = ss.getSheetByName(tabName_(ind, tab));
      if (!sheet) { missingTabs.push(tabName_(ind, tab)); return; }

      var headers = sheet.getLastColumn()
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm_)
        : [];

      tab.cols.forEach(function (col) {
        if (findHeader_(headers, col) < 0) missingCols.push(col.h);
      });
    });

    if (missingTabs.length) {
      lines.push('⚠️ ' + ind.name + ' — missing tabs: ' + missingTabs.join(', '));
    } else {
      lines.push('✅ ' + ind.name + ' — ' + ind.tabs.length + ' tabs' +
        (missingCols.length ? ', unmatched headings: ' + missingCols.join(', ') : ', all headings matched'));
    }
  });

  var text = lines.join('\n');
  Logger.log(text);
  try {
    SpreadsheetApp.getUi().alert('Dashboard setup check', text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* editor run */ }
  return text;
}


/* ================================================================================================
 *  9. OPTIONAL: COMPANY NAME
 *  Set this if you want the client's name in the dashboard header.
 * ============================================================================================== */
const COMPANY_NAME = '';   // ← edit; SETTINGS.COMPANY_NAME is read above via this fallback

/** Exposed so SeedData.gs can reuse the exact same tab naming. */
function demoSheetName(ind, tab) {
  return tabName_(ind, tab);
}

/** Exposed so SeedData.gs can iterate the same industry list. */
function demoIndustries() {
  return INDUSTRIES;
}
