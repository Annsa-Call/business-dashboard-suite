# 06 · Where to host this — Cloudflare Pages, Netlify, Vercel (and the alternatives)

> **If you've already chosen Cloudflare Pages, skip this file** and use
> **`08_CLOUDFLARE_PAGES.md`** — the full click-by-click walk-through.
>
> Short answer to "which one": **Cloudflare Pages** if you expect traffic (unlimited bandwidth,
> free, commercial use allowed) · **Netlify** if you want the gentlest first deploy · **not Vercel
> Hobby**, because its free plan forbids commercial use.

The deciding factor is not speed or features — both are excellent — it is the licence you agree
to when you host a *commercial* portfolio on a free plan.

---

## 1 · The decision in one table

| | **Netlify (Free)** | **Vercel (Hobby)** | Cloudflare Pages (Free) | GitHub Pages |
|---|---|---|---|---|
| Commercial use allowed | **Yes** | **No** — Hobby is for non-commercial personal projects | **Yes** | Grey area (fine for a portfolio, not for running a business) |
| Cost to be compliant | Rs 0 | Pro: **$20 / seat / month** | Rs 0 | Rs 0 |
| Bandwidth | 100 GB/mo soft, metered as *credits* since Sept 2025 | 100 GB/mo soft | **Unlimited** | 100 GB/mo soft |
| Builds | 300 credits/mo — roughly 20 production deploys | 100 deploys/day | 500 builds/mo | None (static only) |
| Custom domain + HTTPS | Yes | Yes | Yes | Yes |
| Password-protected demo links | Yes (paid tiers) | Yes (paid) | Yes (Cloudflare Access) | No |
| Deploy from GitHub | Yes | Yes | Yes | Yes (Actions or branch) |
| Best for | client-facing portfolio | Next.js apps | high-traffic static | simplest possible |

**Why Vercel is the wrong default here:** Vercel's Hobby plan explicitly forbids commercial use.
A portfolio advertising paid dashboard work *is* commercial use. You either break the terms or pay
$20/month per seat — for a static folder of HTML files that Netlify hosts for free, legally.

---

## 2 · What changed at Netlify in Sept 2025 (read this so you're not surprised)

Netlify moved free plans to a **credit** model:

- 300 credits per month.
- One **production deploy costs 15 credits** → about 20 deploys/month. (Preview/branch deploys are
  cheaper; a failed build is cheaper still.)
- Bandwidth: **20 credits per GB** → 300 credits ≈ **15 GB/month** of transfer for this suite's
  ~21 MB of screenshots + 30 dashboards.
- Requests: 2 credits per 10,000.
- **When credits hit zero, sites pause** until the next cycle.

Practical reading for this project: a portfolio that gets a few hundred visits a month is nowhere
near the limit — each visitor downloads maybe 2–4 MB of images. You would need roughly
**4,000–6,000 full page views a month** before bandwidth credits became the binding constraint.
If you start posting reels that go viral, move to Cloudflare Pages (unlimited bandwidth) that same
day — the repo does not change, only the host.

---

## 3 · Deploy in ten minutes (Netlify)

1. **Push the folder to GitHub.**
   ```bash
   cd business-dashboard-suite
   git init
   git add .
   git commit -m "30 industry dashboards"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   Keep `portfolio/`, `demos/`, `screenshots/` in the repo. Skip `node_modules/` (the `.gitignore`
   below covers it).

2. **Netlify → Add new site → Import an existing project → GitHub → pick the repo.**

3. **Build settings:**
   | Field | Value |
   |---|---|
   | Base directory | *(leave empty)* |
   | Build command | *(leave empty)* |
   | Publish directory | `.` — the repo root |
   | Functions directory | *(leave empty)* |

   The repo root contains `index.html`, `demos/` and `screenshots/`, so publishing `.` serves all of
   it and every card link (`demos/…`) resolves. **Do not** set the publish directory to `portfolio/`:
   that publishes only that folder, and the `../demos/…` links in its copy of the page point outside
   it, giving you 30 broken cards.

4. **Deploy.** You get `https://<random-name>.netlify.app` in about 30 seconds.

5. **Domain.** Site settings → Domain management → Add custom domain. Netlify issues the
   Let's Encrypt certificate automatically.

6. **Change the name.** Site settings → General → Change site name → e.g. `yourname-dashboards`.

### `.gitignore`

```
node_modules/
tools/cache/
*.zip
.DS_Store
```

> `index.html` at the repo root is the file to publish. `portfolio/index.html` is a second copy with
> `../` paths kept only so you can open the page straight off disk; `_redirects` sends `/portfolio`
> back to `/` so the duplicate never appears on the live site.

---

## 4 · Cloudflare Pages (same repo, more headroom)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Framework preset: **None**. Build command: empty. Build output directory: `/` (the repo root).
3. Unlimited bandwidth, 500 builds/month, commercial use allowed.

Cloudflare is the better long-term free host; Netlify is the friendlier first-time experience.
Both read the same repository, so switching later is a 5-minute job.

---

## 5 · GitHub Pages (if you want the absolute minimum)

Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `root`.
Your site appears at `https://<you>.github.io/<repo>/`. Then either:

- link people to `https://<you>.github.io/<repo>/portfolio/`, or
- move `index.html` to the root as described above.

GitHub Pages cannot do password protection, redirects or server-side anything — which is why it is
fine for a portfolio and wrong for a client delivery.

---

## 6 · What about actually delivering a client's dashboard?

The demos are static HTML. A **real** client install is different, and the hosting is Google's:

- the sheet lives in the client's Google Drive,
- `Code.gs` is bound to that sheet and deployed as a web app
  (*Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone with the link*),
- the URL is `https://script.google.com/macros/s/…/exec?demo=clinic`.

That URL never touches Netlify. Keep the two things separate in your head: **portfolio = static
site**, **product = Apps Script web app**.

One caveat worth knowing before you promise anything: Apps Script web apps set
`X-Frame-Options: ALLOWALL` only if you ask for it, and Google's quota for consumer accounts is
around 90 minutes of script runtime per day — plenty for a dashboard refresh, not enough for a
thousand concurrent users.

---

## 7 · Recommendation

| Your situation | Use this |
|---|---|
| Just showing the work, small audience | **Netlify Free** (commercial use allowed, zero config) |
| Expecting reels/ads traffic | **Cloudflare Pages** (unlimited bandwidth) |
| No Git at all, drag and drop | Netlify Drop (drag the `portfolio` folder onto app.netlify.com/drop) |
| Client-facing product | Apps Script web app on the client's own sheet |
| Refuse to pay Vercel US$20/mo | Do not use Vercel Hobby for a commercial portfolio |
