# Performance audit

Profiling of the deployed instance against a Lighthouse run reporting
Performance 40, FCP 3.5s, LCP 5.2s, TBT 1,730ms, CLS 0.

**Status: profiled, three fixes landed, no after-measurement.** The diagnosis
below is measured; the effect of the fixes is reasoned. Nobody has run Lighthouse
against the deployed result yet, and this document does not pretend otherwise.

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

**The report no longer blocks on its trend history.** `loadHistory` is passed
down unresolved and unwrapped by `use()` inside a `<Suspense>` boundary around
the chart alone. The report paints on the first API response; the chart arrives
behind it. The fallback reserves the chart's real height, because CLS is 0 on
this page and streaming must not be what breaks it.

`TrendPanel` still takes a plain array — the promise is unwrapped by a small
wrapper. Eight tests render that panel with a literal list, and threading a
promise through its signature would have made every one of them construct one
for nothing.

**Findings render a page at a time.** 30 rows, extended on request, reset
whenever the filter changes so a narrowed result shows its own top rather than a
stale offset. Keyboard navigation extends the page when it walks past the end,
or `scrollIntoView` would look for a row that is not in the DOM.

Incremental rather than windowed, deliberately. `@tanstack/react-virtual` is
installed and still unused: rows expand to arbitrary heights, carry `j`/`k`
navigation, and sit inside a list a screen reader walks. A measured virtualiser
puts all three at risk to save work that paging already avoids. This is the same
judgement made in the file viewer, for the same reason.

---

## Not fixed, with the plan

Ordered by expected impact.

### 1. Mount only the selected tab

All four panels mount on hydration. Radix Tabs can defer unmounted content.

**Plan:** render inactive tab content on first activation, preserving the
`?tab=` deep link.

### 2. Make the shell static

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
