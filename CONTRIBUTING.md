# Contributing

## Getting it running

Requires **Node 20+**. The API lives in
[`vantage-backend`](https://github.com/Asmodeus14/vantage-backend) and needs to
be running for most of the app to do anything.

```bash
npm install
cp .env.example .env.local
npm run dev
```

App at <http://localhost:3000>, expecting the API on port 5000.

## Checks

```bash
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # the one that catches Server/Client Component mistakes
```

All four before opening a pull request. `build` matters more than it looks —
several classes of App Router error only appear there.

## Conventions

- **`lib/types.ts` mirrors the backend's `app/schemas.py`.** It is the contract.
  If you change one, change the other in the same pull request. The version this
  replaced guessed at response shapes — `getSolutionText` tried four field names
  — and rendered fields the backend never sent.
- **No arbitrary colour values in components.** Every colour, radius and
  duration is a CSS custom property in `app/globals.css`, exposed to Tailwind
  via `@theme inline`. Components reference semantic names (`surface`, `border`,
  `fg-muted`) so the palette changes in one place.
- **Severity is colour + icon + text**, always. It has to survive for
  colourblind users and in monochrome.
- **Light and dark are both first-class.** Depth comes from 1px borders and
  small background shifts, not shadows and gradients.
- **Comments explain why.** A comment earns its place by recording a decision or
  a constraint, not by narrating the line below it.
- `noUncheckedIndexedAccess` is on. `array[0]` is `T | undefined`, and that is
  deliberate — handle it rather than reaching for `!`.

## Things that are the way they are on purpose

Before "simplifying" one of these, read the reasoning in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

- **No charting library.** `lib/scale.ts` plus `components/charts/` is about 3kB
  and does not need theming overridden.
- **`rehype-raw` is absent** from the markdown pipeline. That is the XSS
  defence, not an oversight.
- **Two paths bypass the Next proxy** — the ZIP upload and the SSE stream —
  because serverless caps request bodies and buffers streaming responses.
- **`?tab=` and `?q=` use `history.replaceState`**, not `router.replace`, and
  `?q=` is debounced because `replaceState` is rate-limited in Safari.
- **The virtualiser is installed and unused.** The file viewer does not need it
  yet.

## Accessibility

Not optional, and cheap if you do it as you go:

- Every chart renders a visually-hidden table of its values plus an `aria-label`
  stating the trend in words. `ChartShell` does this — use it.
- Interactive elements are real buttons and links with accessible names.
- `globals.css` zeroes every transition under `prefers-reduced-motion`; do not
  reintroduce animation that carries meaning.
- Tests query by role and accessible name. If a test needs `querySelector`, the
  markup is usually the problem.

## Tests

Vitest with Testing Library. Assert on what a user can perceive — roles, labels,
visible text — rather than on implementation.

Test names are sentences about behaviour, and the comment above a test says why
the behaviour matters. That is what makes a failure legible a year later.

## Security

If you have found a vulnerability, **do not open an issue** — see
[SECURITY.md](SECURITY.md).

Anything touching the markdown renderer, the OAuth callback, or `lib/session.ts`
should say so in the pull request.

## Pull requests

- One change per pull request.
- Tests for new behaviour, and a failing test first for a bug.
- Documentation updated in the same pull request.
- All four checks passing.
