# 04 · Corrections — what changed vs the original 12 folders

Your Drive folder `opsdesk_demos` had 12 industry folders plus a README. Here is exactly what was
kept, fixed and added, so you can explain the difference if anyone asks.

## Structure

| Before | After |
|---|---|
| 12 folders, one per industry | `apps-script/` (3 files) + `demos/` (15 files) + `docs/` + `portfolio/` |
| Separate code copies per industry | One engine (`Code.gs`) with 15 industry definitions |
| Data pasted into each file | One seeder (`SeedData.gs`) shared by all industries |

**Why:** fifteen copies of the reading/sorting/charting code is fifteen places a bug can hide.
Now a fix in `Code.gs` reaches every demo at once, and adding an industry is ~80 lines.

## Data

| Before | After |
|---|---|
| Small sample sets | **~42,000 rows** across 15 industries (18 months of history) |
| Flat/random values | Seasonal, weekday-aware, power-law distributions with Pakistani calendar events |
| Same amounts everywhere | Per-market sizing: café ~Rs 200K/day, dental ~Rs 7–9M/month, freight ~Rs 185K/consignment, agency MRR Rs 30–450K |
| Dates not tied to anything | Generated relative to *today* — "upcoming", "overdue" and "this month" always populated |
| Money in one currency/scale | Configurable currency + realistic mill/karor magnitudes |

## Correctness bugs found and fixed while building

These were real modelling errors that produced "obviously fake" numbers. Each is now commented in
the code where the rule lives.

1. **Law firm realisation was 600%.** Invoices were generated independently of recorded time.
   Invoices are now progress bills against *worked value*, giving realisation ≈ 89%.
2. **SaaS NRR reported 150%.** Computed as total MRR now ÷ total MRR 12 months ago, which counted
   new customers as "retention". Now calculated on the same cohort → realistic 85–110%.
3. **Construction backlog was ~Rs 5B** because project contracts were drawn up to Rs 435M.
   Rescaled; backlog now reads ~Rs 2.3B against a Rs 3.4B lifetime book.
4. **Clinic receivables were 5× monthly production**, because no-shows, cancellations and future
   bookings were counted as debt. Only `Unpaid`/`Partial` completed visits count now.
5. **Clinic collection rate hit 99.6%** (flattering) after the fix above — the unpaid mix was
   retuned to sit at ~96–98%, which is the published target band.
6. **Recent-records tables showed only future rows** (all "Pending"), because "recent" sorted by
   date descending including next month's invoices. Tables now look backwards with a small
   forward window (`withinDays`, `futureDays`).
7. **Follow-up card rendered empty** — the `KPI()` factory silently dropped the `items` array.
8. **Salon chair utilisation was 8.6%** (a salon that would close within a month). Chairs and
   appointment volume were reconciled to 55–75%. Chair count is a single constant you can change.
9. **Gym "visits per member per week" was 0** — 3,000 check-ins spread over 18 months is ~6/day
   for 432 members. Attendance is now a dense 45-day log.
10. **E-commerce showed "0 orders this month"** — the generator truncated the *oldest* 2,200 dates
    instead of the newest. Repeat-purchase rate was also 63% vs the 25–30% benchmark.
11. **Agency pipeline was 70% open** with Rs 84M in "Lost" drawn as the biggest pipeline bar.
    Stage weights now reflect a real funnel, and Lost is excluded from the pipeline chart.
12. **Restaurant "Revenue by daypart"** was four identical bars because the daypart was random per
    day rather than a property of the revenue. Replaced with the honest split: dine-in vs delivery.

## New industries (13–15)

| Industry | Why it was added |
|---|---|
| **SaaS / Software** | The most requested dashboard type; tests a cohort-based metric (NRR) that Sheets handles well |
| **Logistics & Freight** | High-volume, thin-margin, OTIF-driven — completely different chart shape |
| **Law Firm** | Professional services with utilisation/realisation/lockup, a KPI family no other demo covers |

Together with the original twelve, the set now covers retail, food, health, education, property,
professional services, subscription software and freight — which is what "all potential clients"
means in practice for a freelance dashboard seller.


---

# Round 2 (v2) — what changed when the suite went from 15 to 30

## Scope

| | v1 | v2 |
|---|---|---|
| Industries | 15 | **30** |
| Rows of sample data | 41,820 | **111,984** |
| Tabs in a full seed | 45 | **90** |
| KPIs / charts | 90 / 45 | 180 / 90 |
| Layouts | 1 | **8** (assigned per industry) |
| Docs | 5 | 7 (hosting + Instagram categories added) |

## The design rule that changed

You said: *"Don't make the design, measuring units or KPIs the same; each industry layout should be
different as the requirements and the needs of the industry."*

v1 had one page arrangement for all fifteen industries. v2 adds a `layout` property to every
industry and eight arrangements in `Index.html`:

- **hero** — hotel (occupancy), gym, SaaS, architecture studio (utilisation)
- **ledger** — e-commerce, law firm, recruitment agency, printing press
- **gauge** — restaurant, plastics plant, auto workshop
- **calendar** — salon, photography studio, pharmacy, bakery
- **scorecard** — school, logistics, poultry farm, garment unit
- **board** — real estate, travel agency, fuel station, solar EPC
- **timeline** — construction, MSP, courier
- **grid** — agency, coaching, clinic, veterinary clinic

Units are now industry-specific too (`Rs/L`, `kg`, `pcs`, `kW`, `Rs/W`, `per 100`, `min`, `nights`),
so the KPI row reads like the trade's own language rather than a rupee column with a different title.

## Defects found while checking the new data against benchmarks

Every one of these was visible in a screenshot or in a KPI dump, not caught by "it compiles":

1. **MSP reported 22% SLA adherence.** The SLA rule required both a response *and* a resolution
   inside target, which almost no ticket meets. Judged on first response only → 92–94%.
2. **MSP showed a median first response of 71 minutes** because P3/P4 targets (60/240 min) dominated
   the median. Targets tightened to 15/20/30/45 min, responses drawn inside them → 8 minutes.
3. **MSP had 1,300 endpoints per engineer** (ceiling is 400–500). Endpoint count and ticket volume
   rebalanced against a 12-engineer desk → 479.
4. **Hotel occupancy came out at 16%**, then RevPAR collapsed to Rs 5,083. A 44-room property needs
   ~5,000 bookings over 18 months, not 1,450 → 55% occupancy, RevPAR Rs 18,745.
5. **Hotel "outstanding folios" was Rs 96M** — it was counting future reservations as debt. City
   ledger only (checked-out stays with a balance, last 90 days) → Rs 4.4M.
6. **Pharmacy stock cover read 743 days** because inventory quantities were ~10× the daily
   dispensing rate. Shelf levels rebuilt against COGS → 49 days.
7. **Pharmacy expiry risk (Rs 14M) exceeded the entire stock value** — it summed unit cost, not
   quantity × cost. Also capped short-dated lines to small quantities → Rs 90K.
8. **Pharmacy donut said "stock value" but plotted units.** Now weighted by quantity × cost.
9. **Poultry FCR 2.0 and zero birds in the shed** — no batch was ever "current". The newest batch is
   now live, and FCR lands at 1.65.
10. **Workshop bay utilisation 6%** — 900 job cards over 18 months for six bays. Volume raised to
    ~9,800 and bookable hours set to 26 working days → 67%.
11. **Textile "on-time shipment 7%"** compared a ship status against a future due date. Now
    shipped ÷ (shipped + delayed) → 93%. DHU also re-centred below the ≤5 benchmark.
12. **Printing prepress queue showed 126 jobs** (18 months of history). Windowed to the last 45 days.
13. **Printed waste averaged 7%** — outside the 2–4% benchmark band for a competent shop → 4.4%.
14. **Architecture WIP was Rs 114M and "receivables overdue" 60% of billings**, because invoices were
    free-floating numbers unrelated to project fees. Invoices are now milestone bills against a real
    project (capped so a project can never be over-billed), and WIP is fee earned by stage minus what
    that project has already been billed → Rs 14.6M.
15. **Solar "receivable" was Rs 930M** (a random payments total subtracted from contract value).
    Billing now follows milestones, and cash collected is capped at what was billed → Rs 181M / 90%
    collected.
16. **Recruitment time-to-fill read 119 days and the current month showed zero fees.** Fill dates are
    now 18–62 days after opening, and twelve recent placements are guaranteed to land inside the
    current month.
17. **Recruitment "fill rate" divided by all mandates**, including ones still open. Now
    filled ÷ (filled + lost) → 84%.
18. **A counting bug in `dailySeries()`** returned zeros whenever no value field was passed, which
    flattened the MSP ticket-volume chart and the vet "consults per day" chart to a flat line at 1.
19. **Fuel station shop sales were 0.3% of turnover** (real forecourts run 2–6%) → 2.1%.
20. **Factory OEE-by-line reported 80.5 / 80.3 / 80.1** — averaging thousands of rows wiped out the
    differences. Each line now carries a health factor → 80 / 74 / 65.

## Visual defects fixed

- **Tables were clipped** in the two presets that give the table a narrow column (ledger,
  scorecard). Added `min-width:0` + tighter cell padding so the table compresses instead of
  overflowing the card.
- **Hero layout left large empty areas** — the headline card is now a filled panel (54 px value,
  sparkline, progress at the bottom) and the third chart spans the full width.
- **Gauge layout stretched the third chart across the whole page**; it is now a normal third column.
- **Poultry recorded "1 flocks still in the shed"** → plural-safe captions.
- Tables titled "open orders" / "live projects" / "open job cards" now actually filter to open
  records instead of showing the newest eight of anything.
