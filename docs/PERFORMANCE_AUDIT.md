# Performance audit

Profiling of the deployed instance against a Lighthouse run reporting
Performance 40, FCP 3.5s, LCP 5.2s, TBT 1,730ms, CLS 0.

**Status: profiled, one fix landed, the main work not done.** This document is
written mid-way on purpose — the diagnosis is worth more than a partial fix, and
recording it honestly is better than implying the job is finished.

---

## The Lighthouse IndexedDB warning is not about this app

> "There may be stored data affecting loading performance in this location:
> IndexedDB."

**Vantage uses no IndexedDB.** No `indexedDB`, no `idb`, no wrapper, anywhere in
`app/`, `components/` or `lib/`. It also uses no `sessionStorage`. The only
client storage is the one key `next-themes` writes to `localStorage` to remember
light/dark.

That warning is almost certainly a browser extension in the profiled session.
Acting on it — "lazily initialise IndexedDB", "paginate the local database" —
would have been work against something that does not exist.

---

## Where the time actually goes

### LCP 5.2s — the architecture, not the client

**Every page route is `force-dynamic`:** `/`, `/history`, `/settings`,
`/r/[id]`, `/r/[id]/f/[...path]`. Nothing is static and nothing streams, so no
HTML reaches the browser until the API has answered.

The API is on a free instance that **sleeps when idle and takes roughly a minute
to wake**. A Lighthouse run against a cold instance is measuring that, not the
frontend.

Worse, the report page issued its requests **in series**:

```
generateMetadata → GET /api/reports/{id}      ← round-trip 1
page body        → GET /api/reports/{id}      ← round-trip 2 (same data)
                 → GET /api/reports?repository=…  ← round-trip 3, needs #2's result
```

Three requests, at least two strictly ordered, before the first byte.

### TBT 1,730ms — the report page's payload and hydration

`/r/[id]` is 22.7 kB of route code on 212 kB First Load JS — the heaviest page,
and the one profiled. The main-thread cost is hydrating a report that renders
**every finding at once**: 61 on the express report, and `MAX_FINDINGS` allows
500.

Contributors, in the order worth attacking:

1. **All findings render eagerly.** `FindingsPanel` maps the whole array. At 61
   this is noticeable; at 500 it dominates.
2. **The whole report payload is serialised into the RSC stream**, including
   every finding's description, snippet and references — around 10 kB of JSON
   per report on average, all of it hydrated whether the Findings tab is open or
   not.
3. **All four tab panels mount**, including charts, regardless of which tab is
   selected.

### What is *not* the problem

Checked and cleared, so they are not re-investigated:

- **Shiki is already lazy** — a dynamic import, absent from every first load.
  `/dev/markdown` at 166 kB is the only route carrying markdown machinery.
- **No charting library.** Charts are hand-rolled SVG, about 3 kB.
- **Icons are tree-shaken** — `lucide-react` per-icon imports.
- **No animation library.** CSS transitions only, zeroed under
  `prefers-reduced-motion`.
- **No web fonts.** System stack, which is also why CLS is 0.
- **Bundle baseline is reasonable** — 107 kB shared is close to the floor for
  Next 15 + React 19.

---

## Fixed

**Duplicate report fetch on every report page.** `generateMetadata` and the page
body each called `load(id)` independently — two full round-trips for identical
data. Now wrapped in React's `cache()`, which collapses them to one for the
request.

Removes one API round-trip from the critical path of the profiled page. On a
warm instance that is tens of milliseconds; on a cold one it is seconds.

---

## Not fixed, with the plan

Ordered by expected impact.

### 1. The report blocks on its trend history

`loadHistory` is awaited before anything renders, and it *depends* on the report
having loaded, so it cannot simply be parallelised. But the trend chart is
explicitly an addition rather than the point of the page.

**Plan:** pass the unresolved promise into a `<Suspense>` boundary around
`TrendPanel` only, unwrapping with `use()`. The report paints on the first
response; the chart streams in behind it. Not attempted here because it touches
three files and a half-finished streaming refactor is worse than none.

### 2. Render findings incrementally

`@tanstack/react-virtual` is already a dependency and unused. It was left out of
the file viewer deliberately — a few hundred lines does not need it — but a
findings list capped at 500 rows does.

**Plan:** virtualise `FindingsPanel`'s list, or render the first ~30 and extend
on scroll. Keep the hidden accessible list intact.

### 3. Mount only the selected tab

All four panels mount on hydration. Radix Tabs can defer unmounted content.

**Plan:** render inactive tab content on first activation, preserving the
`?tab=` deep link.

### 4. Make the shell static

The home page is `force-dynamic` only because it lists recent analyses. The
shell — header, form, examples — never changes.

**Plan:** static shell, `<Suspense>` around the recent list.

---

## What could not be done in this session

**No before/after Lighthouse run.** The measure-change-measure loop the task
asks for was not completed: the numbers above are the ones supplied, not ones I
produced. The `cache()` change is verified by build, lint, typecheck and 131
tests, but its effect on LCP is reasoned rather than measured.

Anyone continuing should run Lighthouse **twice against a warm instance** — hit
`/api/ping` first — because a cold Render start dominates every other number and
makes the frontend changes unmeasurable.
