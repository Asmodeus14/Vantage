# Second-pass performance investigation

All figures are Lighthouse mobile, `throttlingMethod: simulate`, against
`https://vantage67.vercel.app/`.

| | Before | After | |
|---|---|---|---|
| Speed Index | 20.8s | **7.7s** | −63% |
| LCP | 3.9s | **3.5s** | −10% |
| FCP | 3.2s | 3.2s | — |
| TBT | 730ms | 930ms | +27% |
| CLS | 0 | 0 | — |
| Performance | — | 0.57 | |

---

## Part 1 — Speed Index 20.8s

**Cause: infinite CSS animations on the loading state. Introduced by the
previous pass.**

Speed Index integrates how long a page spends visually different from its final
frame, so a region that never stops changing means the page is never visually
complete. `animate-pulse` is `animation: … infinite`, and it was on the shared
`Skeleton` primitive plus the `TrendSkeleton` added in the streaming pass.

Replaced with `animate-skeleton` — the same pulse, bounded to four cycles,
disabled under `prefers-reduced-motion`.

**Confirmed by measurement: 20.8s → 7.7s.**

The residual is no longer animation. Observed Speed Index is now 4,415ms against
an observed first paint of 4,366ms — visual completeness lands within 50ms of
the first pixel, which is what a settled filmstrip looks like. The remaining
7.7s is Lantern's simulated figure for a page that shows nothing for 4.3s, which
is Part 2.

---

## Part 2 — 4.3 seconds of blank white screen

The filmstrip is the finding. **Five consecutive frames — 872ms, 1743ms,
2615ms, 3487ms, 4358ms — are blank white.** First visual change: 4,365ms.

The LCP breakdown says exactly where it went:

| Subpart | Duration |
|---|---|
| Time to first byte | 61ms |
| **Element render delay** | **4,305ms** |

And the document request:

```
GET /              networkRequestTime    16.8ms
                   server response       43ms      ← fast
                   networkEndTime      3,479ms     ← 3.46s to finish streaming
```

43ms to the first byte, 3.46s to the last one. The server was not slow; the
response was held open. `HomePage` awaited `recentReports()` at the top of the
component, so nothing could flush until the API answered.

The knock-on is visible in the waterfall: the stylesheet is not even *requested*
until 3,587ms, because the parser cannot discover it until the document ends.
Every script follows it.

**Fixed.** The page component now contains no `await` and touches no dynamic
API. The shell — heading, form, section frame — flushes on the first chunk; the
recent list streams in behind a `<Suspense>` boundary. The fallback renders the
same heading component as the resolved list and reserves real row heights, so
CLS stays at 0.

This was already scheduled in `PERFORMANCE_AUDIT.md` as "make the shell static".
The trace moved it from *plausible* to *measured*.

---

## Part 3 — three further defects the trace exposed

### `/api/auth/me` was requested twice, at 2.3s and 2.1s

```
/api/auth/me   4,556ms → 6,868ms   (2,312ms)
/api/auth/me   4,572ms → 6,666ms   (2,094ms)
```

`useSession` fetched per-consumer, and the home page mounts two of them —
`UserMenu` and `RepoPicker`. Both got the same answer, twice, from an API that
sleeps on the free tier.

Deduplicated at module scope. That lifetime matches the session's: signing in is
an OAuth redirect and signing out is a form POST, so both replace the document
and reset the cache. Nothing can change the session without a page load, so
nothing can leave it stale. A failed request clears the cache so a later mount
retries.

### The account link had no accessible name

Lighthouse `link-name` failed, and it is a genuine bug rather than a scoring
artefact. The username is `hidden sm:inline` and the avatar is `alt=""`, so on a
phone the link is in the tab order with nothing to announce. Given an
`aria-label` that does not depend on the viewport.

### `--fg-subtle` failed WCAG AA

3.41:1 on white, against a 4.5:1 requirement, on four elements. Not decoration —
timestamps, finding counts and file paths all use this token. Darkened to 4.7:1.

The audit only measured light mode. Computing the dark value showed it at 4.2:1,
also failing and never reported, so both were fixed.

---

## TBT went the wrong way — and this run cannot say why

730ms → 930ms. Two things prevent me from calling that a regression:

**The profiled browser was full of extensions.** The trace contains a 1.7MB
MetaMask content script, Loom, an ad blocker and a reader-mode extension.
Third-party attribution gives 357ms of main-thread time to MetaMask alone, and
1,149ms of CPU is "Unattributable". Lighthouse's own run warning asks for an
incognito profile, and the IndexedDB warning it reports comes from those
extensions — this app uses no IndexedDB.

**The two runs may not be the same page.** This trace is of `/`. The first-pass
audit analysed `/r/[id]`, the heaviest route. Comparing TBT across them is not
comparing anything.

So the honest position is that TBT is unmeasured on a clean profile. Re-run in
incognito before treating 930ms as real.

---

## What is verified, and what is not

**Verified:** lint, typecheck, 134 tests, production build. Speed Index 20.8s →
7.7s is a real before/after measurement.

**Not verified:** the blank-screen fix, the session dedup and the two
accessibility fixes all landed after this trace. Their effect is reasoned, not
observed.

---

## Next

1. **Re-run Lighthouse in incognito**, on `/` and on `/r/[id]` separately.
   Expect FCP and Speed Index to fall sharply — the streaming change removes
   3.4s from the critical path — and expect the accessibility failures to clear.
2. Only then judge TBT. If it is still high on a clean profile, the target is
   `/r/[id]`, and `PERFORMANCE_AUDIT.md` already names the work: mount only the
   selected tab.
3. Legacy-JavaScript polyfills cost 11.7 kB in one chunk (`Array.prototype.at`,
   `Object.hasOwn`, `String.prototype.trimStart` and others). A `browserslist`
   narrowed to modern targets removes them. Small, safe, unmeasured.

---

# Third measurement — `/r/[id]`, and what it confirmed

Lighthouse mobile, simulate throttling, `https://vantage67.vercel.app/r/pJDYcj-wKSjf`.

## The four fixes from the previous section all landed

| Audit | Before | After |
|---|---|---|
| `link-name` | **fail** | pass |
| `agent-accessibility-tree` | **fail** | pass |
| `--fg-subtle` contrast | **3.41:1 fail** | absent from failures |
| `/api/auth/me` requests | **2** (2.3s, 2.1s) | **1** |
| Avatar transfer | 21,849 B | **1,922 B** |
| Accessibility | 0.93 | **0.97** |

The avatar now requests `?v=4&s=64` and `image-delivery-insight` reports nothing.

## The report page's bottleneck is different from the home page's

FCP is **3.5s and observed at 1,308ms** — much faster than home was, because
`app/r/[id]/loading.tsx` paints skeletons immediately. So the shell was never
the problem here.

LCP is **5.3s**, and the breakdown says where it went:

| Subpart | Duration |
|---|---|
| Time to first byte | 62ms |
| **Element render delay** | **6,901ms** |

The waterfall names the cause. The route's own JavaScript is **not requested
until 6,751ms**:

```
2139-*.js   6,751ms   153 kB resource, 99.8% unused
1553-*.js   6,768ms
3123-*.js   6,788ms
app/r/[id]/page-*.js   6,806ms
```

The document itself does not finish streaming until **11,645ms**.

**153 kB downloaded and parsed, and 99.8% of it never runs.** Radix Tabs
declines to mount inactive tab content, so `FindingsPanel`,
`DependenciesPanel` and `ActivityPanel` were shipped as dead weight on every
report load — and shipped *late*, competing with the content the reader is
waiting for.

## Fixed

The three non-default panels are now `next/dynamic` with `ssr: false`. Overview
opens by default and stays a normal import. Each has a skeleton that reserves
row height, because CLS on this page is 0.001 and code-splitting must not be
what changes that.

**Measured:**

| | Before | After |
|---|---|---|
| `/r/[id]` First Load JS | 212 kB | **156 kB** |
| `/r/[id]` route code | 22.9 kB | **17 kB** |

56 kB off the critical path of the heaviest route. This is the
"mount only the selected tab" item from `PERFORMANCE_AUDIT.md` — the trace
showed the real cost was *loading* the code, not mounting it.

## Still open

**TBT 1,531ms**, and this run still cannot settle it. The profile again carried
a 1.7 MB MetaMask content script and four other extensions; 1,830ms of CPU is
"Unattributable" and Lighthouse repeats its incognito warning. Within our own
code the largest single contributor is `1255-*.js` at 1,737ms CPU — the
React/Radix vendor chunk, shared by every route.

**The document streams for 11.6s.** TTFB is 62ms, so this is the report page
awaiting its API the way the home page used to. The home page fix does not apply
unchanged: there is no meaningful shell for a report without the report. The
honest next step is to find what holds the stream open past the content —
likely the trend-history boundary — rather than assume.

**`meta-description` failed**, dropping SEO to 0.91. `generateMetadata` does set
`description` from `report.score.summary`, and that summary demonstrably
rendered — it is the LCP element. The audit and the code disagree, so this needs
`view-source` on a deployed report page before anything is changed.

**Legacy JavaScript**: 11.7 kB of polyfills (`Array.prototype.at`,
`Object.hasOwn`, `String.prototype.trimStart`) in `1255-*.js`. A narrowed
`browserslist` removes them. Small, safe, still unmeasured.

---

# Fourth measurement — `/r/[id]`, after the stream cap

The previous fixes are confirmed by trace. Same page, same route:

| | Second pass | Now |
|---|---|---|
| Performance | 0.43 | **0.55** |
| FCP | 3.4s | **1.0s** |
| LCP | 4.6s | **2.7s** |
| Speed Index | 7.1s | **2.8s** |
| TBT | 1,840ms | **513ms** |
| CLS | 0.001 | 0.0003 |
| Accessibility | 0.97 | 0.97 |

Three of the four items left open above are now settled — by measurement, not
by argument.

## The document does not stream for 11.6s. It streams for 6.4s, in three flushes

Timing every chunk off the wire (`curl -sN`, warm, repeated) gives the shape the
Lighthouse trace could only imply:

```
  457 ms   cum 21,828   shell + loading.tsx   <- FCP happens here
4,936 ms   cum 47,337   page body, metadata, route chunks
6,568 ms   cum 48,220   the history boundary
```

TTFB is 394–457ms. The 48 kB document takes **6.4s**, and every millisecond
past the first flush is the server waiting on the API:

- **+4.5s** — `await load(id)`, the report itself
- **+1.6s** — `loadHistory`, which still holds the response open

The earlier note that this was "the report page awaiting its API" was right.
What it could not say is the split, and the split matters: the trend chart is
**25% of the document's life** for a panel that is not the point of the page.
The 3s cap added last pass bounded it but did not remove it — measured cost is
1.6s, comfortably inside the cap.

Correspondingly, the route chunks are not late for their own reasons. They are
in flush 2, at 4,936ms, because that is when the page body is emitted at all.

### Fixed — the trend loads from the browser

The history was fetched on the server and handed down as an unawaited promise,
unwrapped by `use()` inside a Suspense boundary in `OverviewPanel`. That kept it
off the *first paint* but not off the *response*, which is the distinction the
previous pass missed: the boundary is the last thing in the page, so the
document could not end until it resolved.

It could never have been parallel, either — it needs the repository name that
only the report carries, so on the server it was always a second serial
round-trip.

`TrendPanelClient` now fetches `/api/reports` from the browser. Same-origin, so
the session cookie still rides along and the listing stays scoped to the caller
exactly as before. Failure still degrades to an empty history rather than taking
the report down, and the request is aborted if the repository changes.

`TrendPanel` itself is untouched — it still takes a plain array, and its eight
tests still drive it directly. Six new tests cover the part that moved.

**Verified in the build:** the server bundle for `/r/[id]` now contains zero
references to `listReports` or `/api/reports`; the client route chunk carries
the fetch. The second server round-trip is gone by construction, so flush 3
cannot exist. `/r/[id]` First Load JS 156 kB → 157 kB.

The trade is deliberate and worth naming: the chart now arrives after hydration
rather than in the first paint. It is a secondary panel, below the fold, and it
was costing a quarter of the response for every reader whether they scrolled to
it or not.

The end-to-end number is not claimed here. The document should now finish with
the report, near 4.9s — but that is an inference from where the bytes went, and
it should be re-measured with the same `curl -sN` chunk timing once this is
deployed.

## `meta-description`: the audit and the code were both right

`view-source` on the deployed page settles it. The description **is** present:

```
byte  1,777   </head>
byte 31,007   <meta name="description" content="No critical or high-severity …">
```

It is emitted 29 kB *after* `</head>`, in the body. Lighthouse's `MetaElements`
gatherer queries `head meta`, so it does not see it.

The cause is **Next.js streaming metadata** (default since 15.2; this project
runs 15.5.23). Because `generateMetadata` awaits the API, Next declines to block
the shell on it and streams the whole metadata block — the page's *and* the
layout's, since they resolve as one unit — into the body later. That is why the
initial `<head>` has `theme-color` but no `<title>` and no description.

This is a real consequence of a deliberate trade: the shell flushes at 457ms
*because* metadata does not block it. Moving the description back into the first
flush means either dropping the per-report title and description, or making the
report fetch fast enough that metadata is not worth streaming. The second is the
same fix as everything else on this page.

## Legacy JavaScript is not removable, and `browserslist` is the wrong lever

The 11.7 kB in `1255-*.js` is byte-for-byte
`next/dist/build/polyfills/polyfill-module.js`:

```js
"trimStart"in String.prototype||(String.prototype.trimStart=…),
Array.prototype.flat||(…), Array.prototype.at||(…),
Object.fromEntries||(…), Object.hasOwn||(…)
```

Exactly the method list Lighthouse reports. Next injects it into the module
bundle unconditionally; `browserslist` does not gate it.

This was tried and reverted. Adding `browserslist` produced an **identical
content hash** for both `1255-*.js` and `polyfills-*.js` — no effect on JS at
all — while Tailwind v4 routes `browserslist` into Lightning CSS, so keeping it
would have quietly changed CSS output in exchange for nothing. Removing this
11.7 kB means leaving Next's build, which is not worth it.

## Contrast: fixed, and wider than the audit reported

`color-contrast` flagged three elements — `--medium` at 3.89:1 and `--high` at
4.16:1 on white. Checking the whole ramp against *its own chip backgrounds*,
which is the pairing these are actually used in and the stricter of the two,
found two more that the audit never had a chance to see because no info or
success chip was on screen.

| token | was | on white | on chip | now |
|---|---|---|---|---|
| `--high` | `39%` ← 44% | 4.16 → **5.11** | 3.84 → **4.72** | `#b84d0f` |
| `--medium` | `33%` ← 38% | 3.89 → **4.97** | 3.69 → **4.72** | `#976611` |
| `--info` | `45%` ← 46% | 4.83 → **5.05** | 4.39 → **4.59** | `#686f7d` |
| `--success` | `31%` ← 32% | 4.52 → **4.81** | 4.28 → **4.55** | `#1c8252` |

Lightness only. Hue and saturation are untouched, so the ramp still reads as the
same ordered set of colours. `--critical` and `--low` already passed both.

## The largest single cost on the page is not ours

`vercel.live` — the Vercel Toolbar — accounts for:

- **1,129,574 B of 1,563,571 B total page weight (72%)**, the bulk of it
  `instrument.*.js` at 834 kB transferred / 2.73 MB decompressed
- **801.5ms of main-thread time**
- **534ms of the ~1,157ms in long tasks** — roughly half of TBT
- **both** Best Practices failures: `third-party-cookies` and
  `inspector-issues`, both from `vercel.com/api/www/avatar`

Weight arithmetic puts Best Practices at 20/26 = 0.77. Disabling the toolbar
should take it to **1.00** and roughly halve TBT.

This is a **Vercel project setting, not a code change** — Settings → Toolbar,
disable for Production. It cannot be fixed from this repository.

> **Corrected by the fifth measurement.** This section called the toolbar "the
> largest single cost on the page" and the biggest remaining win. That is true
> of the trace it was read from, and false of the site. `vercel.live` is not in
> the HTML served to an anonymous visitor at all — the toolbar only loads for a
> viewer signed in to Vercel with access to the project, which means the author
> and nobody else. A clean audit records **no third-party entities**. Nothing
> needs disabling; the setting costs real users nothing. See below.

## Where the 6.4s actually goes, and what is not yet proven

Measured through the Vercel proxy, warm, repeated:

| | |
|---|---|
| `/api/health` (touches the DB via `probe_database`) | **0.40s** |
| `/api/reports?limit=1&repository=…` | **1.71s** |
| `/api/reports?limit=20&repository=…` | **1.82s** |

Latency is **flat in row count** — `limit=1` and `limit=20` return the same
437-byte body and take the same time — so this is fixed per-request cost inside
the report path, not data volume. `current_user` returns `None` without a query
for anonymous callers, so it is not the dependency either.

**Not yet identified.** Isolating it needs the backend hit directly rather than
through Vercel, and its Render hostname is a Vercel environment variable that is
not in either repository.

Two things found while looking, both real but neither confirmed as the cause:

1. **`PostgresReportStore.list` over-fetches.** `store.py:308` is
   `select(ReportRow)` — every column, including the full report `payload` —
   and lines 329–338 deserialise it for `source` and `severity_counts`. Three
   comments in that file state the opposite: *"without deserialising every
   payload"* (`:57`), *"listing never needs to deserialise this"* (`:60`),
   *"never touches `payload`"* (`:311`). Harmless at one row, which is why the
   flat timing above does not implicate it; it becomes the cost of every
   listing as history grows. **Not fixed here** — there is no `test_store.py`
   and no Postgres-backed test, so the change is unverifiable locally and would
   ship blind to the only environment that runs it.

2. **`/api/health` reports `"environment":"development"` in production**, while
   `render.yaml` sets `ENVIRONMENT=production`. Either the blueprint is not
   applied to the running service or it is overridden in the dashboard. Worth
   resolving on its own: anything else keyed off that variable is also wrong.

---

# Fifth measurement — production, on a clean profile

Everything above was read from traces captured in a browser carrying MetaMask,
Loom, an ad blocker, reader mode and three more extensions, while signed in to
Vercel. Lighthouse warned about that on every run. This one was measured with a
headless Chrome, no extensions, no Vercel session — which is what a reader gets.

| | `/` | `/r/[id]` |
|---|---|---|
| Performance | **94** | **95** |
| Accessibility | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO | **100** | **100** |

FCP 1.0s · LCP 2.0s · Speed Index 2.5s · TBT 230ms · CLS 0.001

## What that changes

**The Vercel Toolbar was never the problem.** It is not in the HTML served to
an anonymous visitor — a clean audit records no third-party entities at all. The
1,129,574 B and 801.5ms attributed to it were real, but they were being paid by
one person: whoever was signed in to Vercel while measuring. The advice to
disable it is withdrawn. Nothing needs changing in the dashboard.

**Both Best Practices failures went with it.** `third-party-cookies` and
`inspector-issues` were both the toolbar's avatar request. 0.77 → 1.00 without
a line of code.

**TBT was mostly extensions.** 513ms measured, 230ms real. The "Unattributable"
CPU in the earlier traces was the extensions, exactly as the incognito warning
kept saying.

## What was actually ours, and is now fixed

| | Before | After |
|---|---|---|
| Document stream | 6.4s, three flushes | ends with the report |
| `color-contrast` | 4 tokens below AA | Accessibility 100 |
| `meta-description` | failing site-wide | in the first-flush `<head>` |
| `robots-txt` | HTML 404 parsed as robots syntax | real `robots.txt` |
| SEO | 83 | **100** |

## The lesson worth keeping

Three of the four things this document spent the most words on — the toolbar,
TBT, the "20.8s Speed Index" that started the whole investigation — were
measurement artefacts of the profile doing the measuring. The two real defects,
`meta-description` and `robots-txt`, were each worth one audit and neither was
visible without reading the served bytes.

**Measure on a clean profile first.** Every hour spent above the line between
those two facts was spent on someone else's browser extensions.

## Still open

- **Backend latency.** `/api/reports` costs ~1.3s more than `/api/health` warm,
  flat in row count. Unattributed; needs the Render host directly.
- **`PostgresReportStore.list` over-fetches** the full payload per row while
  three comments claim it does not. Untested on Postgres, so left alone.
- **`/api/health` reports `"environment":"development"`** in production.
