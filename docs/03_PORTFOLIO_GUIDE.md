# 03 · Portfolio Guide — how to post these and what to say

You now have **30 demos**. Here is the honest mechanics of using them to build trust, in the
order that works.

---

## 1. Lead with the problem, not the screenshot

Nobody buys "a dashboard". They buy "I stopped losing Rs 80,000 a month on no-shows".
Each demo already carries its pitch line at the top of the page — reuse it as the post text.

| Industry | Post headline that works |
|---|---|
| Dental | "Most clinics collect 95% of what they bill. Here's what the missing 5% looks like." |
| Restaurant | "Food cost crept from 30% to 34%. On a Rs 7M month that's Rs 280,000 gone — and no report said a word." |
| Gym | "A gym with 400 members and 5% monthly churn replaces half its roster every year." |
| Law firm | "Utilisation 38%. Realisation 88%. Collection 93%. Three leaks, one screen." |
| Hotel | "55% occupancy at Rs 34K ADR. RevPAR is the only number discounting can't flatter." |
| Factory | "OEE 74%: the machines are running, they're just not running at rate." |
| Poultry | "FCR 1.65 vs 1.80. On 9,000 birds that gap is pure feed cost." |
| Fuel station | "Your margin is fixed by the government at Rs 9.98 a litre. So the only lever left is litres." |
| Pharmacy | "20.9% gross margin, 49 days of stock, Rs 90K expiring in 90 days." |
| Courier | "94% on-time, but Rs 511K of COD is still sitting with riders." |
| Solar | "427 kW sold this month, 59 systems waiting on a net-metering approval." |
| Freight | "OTIF at 92% looks fine until you convert it into customer churn." |
| SaaS | "If your NRR is calculated on total MRR, it's flattering you." |

## 2. Post the format that matches the platform

| Platform | Best format | Why |
|---|---|---|
| LinkedIn | 1080×1080 carousel: KPI cards → one chart → the "why" | Native document posts out-reach links |
| Instagram | 3-slide story per industry → "DM for the live demo" | Story completion > link clicks |
| Reddit (r/smallbusiness, r/restaurateur, r/dentistry) | Plain text + one screenshot, *no* hard pitch | Read the room; answer questions first |
| Upwork / Fiverr portfolio | The 30 screenshots + a 2-minute Loom walkthrough | Buyers skim images, then watch once |
| Instagram (Pakistan) | 3-slide carousel in the owner's own units — see `07_INSTAGRAM_CATEGORIES.md` | The vocabulary is the hook: FCR, DHU, RevPAR, scripts/day |
| Cold email | 1 screenshot + "this is your industry, your numbers, nothing to install" | Attach the HTML file? No — send the hosted link |

**Where to host it:** `06_HOSTING_DECISION.md`. Short version — push the folder to GitHub, import to
Netlify, publish directory `portfolio`. Netlify's free plan permits commercial use; Vercel's Hobby
plan does not. Every card already opens in a new tab (`target="_blank"`), so the portfolio page stays
where it is while the dashboard opens beside it.

Full-size PNGs are in `screenshots/`. Use those as thumbnails; they were rendered at 2× so they
stay sharp on retina.

## 3. Always show the *live* version in a call

Have the Apps Script web app deployed once with all 30 industries seeded. In a call:
`/exec?demo=clinic` — switch industry while they watch. It takes ten seconds and lands better
than any deck: *"that's your sheet, real numbers, no new software login."*

## 4. The three objections, answered

| Objection | Answer |
|---|---|
| "We already have Looker Studio." | "Looker is free but it shows *reports*. This is a Sheet they already maintain — no connector fees, no per-seat cost, works on their phone. And they can edit the logic in plain JavaScript." |
| "Can it read our existing sheet?" | "Yes — it matches column headings loosely (Invoice No / Ref / Reference all work). Send me a sample of your headings and I'll confirm in a day." |
| "Who maintains it?" | "The sheet is the database. New rows appear on refresh. You own the file." |

## 5. Pricing scaffold that these demos support

| Tier | Scope | Typical band (PK / USD) |
|---|---|---|
| Demo → Single industry, seeded | Deploy + branding + one round of edits | Rs 15–35K / $60–140 |
| Single industry, real data | Column mapping, 2 revisions, 1 month support | Rs 45–90K / $180–350 |
| Multi-branch / role-based | Extra tabs, targets vs actual, team column | Rs 120–250K / $450–900 |
| Retainer (sheets ops) | Monthly new metric + maintain | Rs 20–40K/mo / $80–150/mo |

Prices are yours to set; the point is that **the demo already proves the top two tiers**, which is
why they convert better than a generic "I build dashboards" profile.

## 6. Posting checklist

- [ ] Re-render screenshots after any code change (`node build/build-demos.js`)
- [ ] Check the demo on a phone (390px) — most owners open links on WhatsApp
- [ ] One industry per post; never dump all fifteen at once
- [ ] Include the "why these numbers" line; it is what signals you understand the business
- [ ] End with a specific CTA ("reply 'clinic' and I'll send the live link"), not "DM for details"
- [ ] Keep the numbers honest — these came from published benchmarks, so you can defend them
