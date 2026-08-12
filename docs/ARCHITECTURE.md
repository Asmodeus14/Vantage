# Architecture

Two deployable units in two repositories, deployed independently.

```
vantage-frontend/          Next.js 15 (App Router) + TypeScript → Vercel
vantage-backend/           FastAPI + Python 3.12                → Render
                                                                    → Neon Postgres
```

They stayed separate because they already were, with their own remotes and
deploy pipelines. Merging them into a monorepo would have cost a day and bought
nothing.

**This document covers the browser side only.** The rule engine, persistence,
archive containment and the AI security model are documented in
[`vantage-backend/docs/ARCHITECTURE.md`](https://github.com/Asmodeus14/vantage-backend/blob/master/docs/ARCHITECTURE.md).

---

## Request paths

Most traffic goes browser → Next route handler → FastAPI, which keeps the API
origin server-side. **Two paths deliberately bypass that proxy:**

| Path | Why it goes direct |
|---|---|
| `POST /api/analyze/upload` | Serverless functions cap request bodies at roughly 4.5 MB. A project archive is far larger. |
| `GET /api/analyze/{job}/events` | Serverless buffers streaming responses, which would deliver every progress event at once when the job finished — defeating the point. |

Both are covered by an explicit CORS allowlist. A third path — the AI action —
used to go direct and no longer does: it is a plain JSON POST, and routing it
through this server is what lets it carry the session.

---

## Module layout

```
app/
  layout.tsx              Theme provider + app shell
  page.tsx                Analyse (repo URL primary, ZIP secondary)
  analysing/[jobId]/      Live SSE progress   (+ loading.tsx)
  r/[id]/                 Report — Overview · Findings · Dependencies · Activity
                          (+ loading.tsx, not-found.tsx)
  history/                (+ loading.tsx)
  settings/
  dev/markdown/           Visual QA surface for the markdown renderer
  api/
    health/ reports/ analyze/repository/     JSON proxies to FastAPI
    reports/[id]/findings/[findingId]/ai/    AI action proxy
    auth/github/login/ auth/github/callback/ OAuth — see Sign-in
    auth/me/ auth/logout/

components/
  ui/                     Primitives on shadcn/Radix, restyled to our tokens
  charts/                 Hand-rolled SVG chart primitives
  markdown/               Model-output renderer + code blocks
  report/                 Report surfaces, incl. trend-panel and activity-panel
  app-shell · user-menu · account-panel · link-pending · analyse-form
lib/
  types.ts                Mirrors schemas.py — the contract
  api.ts                  Typed client; uniform structured errors
  config.ts               Env vars, in one place
  session.ts              Signed OAuth state, session cookie (server-only)
  use-session.ts          Current user, for client components
  route-helpers.ts        Uniform error responses from route handlers
  severity.ts             Severity presentation (colour + icon + label)
  scale.ts                Chart maths — scales, ticks, path builders
  highlighter.ts          Lazy Shiki, dual-theme
  use-analysis-stream.ts  SSE state machine
```

Note the `api/` directory is **not** purely a proxy: the OAuth callback performs
a code exchange with GitHub and sets a cookie.

The report's active tab lives in a `?tab=` search param, updated through
`window.history.replaceState` rather than a router navigation: the route is
`force-dynamic`, so `router.replace` would round-trip to the server to
re-render output that has not changed.

### Navigation feedback

Every route is `force-dynamic`, so following a link means waiting on the API.
Two mechanisms cover different windows of that wait:

- **`components/link-pending.tsx`** uses `useLinkStatus` and renders in the
  browser the instant a link is clicked — before the server has responded at
  all. Without it a click on a report row leaves the previous page on screen
  with no acknowledgement, which reads as a dead button.
- **`loading.tsx`** in each dynamic route takes over once the server begins
  streaming, with shapes mirroring the real header so content lands in place
  rather than shifting.

The analyse form also holds its submitting state *through* the navigation.
`router.push` returns before the navigation completes, so clearing it in a
`finally` — as it once did — dropped the button back to idle mid-flight.

### Charts

There is no charting library. The charts this product needs are a line, a bar
and a sparkline over at most a few dozen points, and a library would cost more
in bundle size and in overriding its theming than `lib/scale.ts` plus
`components/charts/` cost to own — the report page carries about 3kB for them.

Three rules hold across all of them:

- **Measured, not scaled.** A fixed `viewBox` stretched to `width: 100%` scales
  the axis labels too, so an 11px tick becomes 7px on a phone. Charts observe
  their container and draw at real pixel sizes.
- **Every chart has a non-visual equivalent.** `ChartShell` renders a
  visually-hidden table of the underlying values plus an `aria-label` that
  states the trend in words. An SVG of `<path>`s is unreadable otherwise.
- **Colour still means something.** The severity ramp is ordinal and semantic,
  so it is used only when severity is the dimension being plotted. Everything
  else draws from a separate categorical ramp (`--series-1` … `--series-5`).

Charts must also read correctly with no animation: `globals.css` zeroes every
transition under `prefers-reduced-motion`.

### Design system

All colour, radius and duration values live as CSS custom properties in
`app/globals.css` and are exposed to Tailwind via `@theme inline`. Components
reference semantic names (`surface`, `border`, `fg-muted`) — there are no
arbitrary hex values in component files, so the palette changes in one place.

Light and dark are both first-class. Depth comes from 1px borders and small
background shifts rather than shadows and gradients; colour is reserved for
severity and state, so it means something wherever it appears.

Severity is always **colour + icon + text label**, so it survives for colourblind
users and in monochrome.

### Rendering model output

Gemini answers in Markdown, so they go through a real parser — `react-markdown`
with `remark-gfm` — in `components/markdown/`. Nothing about the pipeline is
string manipulation: no regex rewriting, no splitting on newlines, no stripping
of `#`, no assembling HTML from the response text.

Raw HTML is never parsed. `rehype-raw` is deliberately absent, so markup in a
response is escaped and displayed as text rather than executed, and
`rehype-sanitize` runs on top as defence in depth against a future plugin
reintroducing HTML parsing. The sanitiser schema is GitHub's, widened only for
language classes on `code` and disabled checkboxes for task lists.

Fenced blocks are read off the hast node rather than the rendered children, so
the language class and the exact source text are exact, and are handed to
`CodeBlock`. Highlighting is Shiki, loaded lazily and rendered dual-theme via
`--shiki-light` / `--shiki-dark` custom properties so a theme switch does not
re-highlight. Unhighlighted code paints immediately at the same metrics and is
swapped when Shiki resolves, so colour arrives without reflow. Shiki escapes
every token it emits and only ever receives plain text from a fence.

Prose is capped at a reading measure while code and tables keep the full width;
`app/dev/markdown` renders every fixture from `lib/markdown-fixtures.ts` for
visual inspection, and the same fixtures are asserted in `tests/markdown.test.tsx`.

### Type safety across the boundary

`lib/types.ts` mirrors `app/schemas.py`. The previous UI guessed at response
shapes — `getSolutionText` tried four field names — and rendered several fields
the backend never sent. Typing the boundary makes that class of bug a compile
error.

### Reporting absence honestly

Three surfaces exist mainly to avoid implying data that is not there, and each
was written after seeing the alternative look wrong:

- **`trend-panel.tsx`** draws a chart only at three or more analyses. With one
  it says so in a sentence; with two it states `91 → 91 across two analyses`,
  because a chart of a single segment is a 200px rectangle restating two
  numbers.
- **`activity-panel.tsx`** lists only files that actually changed, summarising
  the rest ("21 other files carrying findings have not changed"). Ranking
  twenty-five files by a churn of zero puts a misleading heading over
  meaningless rows. When every file is unchanged it says the code is settled,
  which is itself an answer.
- The **Activity tab is absent**, not empty, when `report.activity` is null —
  uploads have no repository to query.

Partial results always carry the reason verbatim from the API rather than a
generic "unavailable".

---

## Sign-in

The OAuth code exchange happens **here**, on the frontend server, not on the
API. Two consequences, both deliberate:

- `GITHUB_CLIENT_SECRET` never has to exist on the API.
- The session cookie is **first-party** — same site as the page.

That second point is the whole design. In production the two halves live on
different sites (Vercel and Render), so a cookie set by the API would be
third-party: blocked outright by Safari and by Firefox in strict mode. It would
pass every test in Chrome and then fail for a large share of users. The API
therefore never sets a cookie; this server reads its own and forwards the
session as `Authorization: Bearer`, and CORS keeps `allow_credentials=False`.

**`state` is signed, not stored** (`lib/session.ts`). A server-side map would
fail roughly half the time under more than one worker — and Render runs two —
because the callback can land on a different process than the redirect. The
signed value carries an expiry and the return path; `safeReturnTo` refuses
absolute URLs and the protocol-relative `//host` and `/\host` forms, so sign-in
cannot become an open redirect.

GitHub answers **HTTP 200 with an error body** for a reused or bad code.
Checking only the status sails straight past it and fails somewhere far less
obvious, so the callback inspects the payload.

`/api/auth/me` reports the **combined** state of both halves, consulting the
API's `/api/auth/status`. Configuring only one side otherwise offers a sign-in
button for a flow that fails at the last step.

Scopes are requested narrowly: `read:user` alone by default. `repo` is asked for
only when someone explicitly opts into private-repository analysis, because it
grants read *and write* to every private repository on the account.

---

## Constraints

- **A signed-in user's ZIP upload is still attributed anonymously.** The upload
  posts directly to the API to clear the serverless body cap, so it cannot carry
  the session cookie. A single-use upload ticket is the fix; it is not built.
- **Sign-in has not been exercised against real GitHub.** The consent step needs
  a human. The Safari and Firefox strict-mode check is the one most likely to
  catch a real break.
- **Findings snippets are not syntax highlighted.** Shiki is wired for AI and
  markdown output but `components/report/code-snippet.tsx` renders plain
  monospace with the offending line marked.
