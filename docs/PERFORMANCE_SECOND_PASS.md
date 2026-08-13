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
