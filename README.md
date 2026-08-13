# Vantage

**Point it at a repository and it tells you what is wrong, exactly where.**

Paste a GitHub URL. Vantage fetches the source, runs a rule engine over it,
and returns a scored report where every finding is anchored to a file and line
with the offending code shown beside it — known vulnerabilities from real
advisory data, committed credentials, correctness bugs, and structural problems.

With an API key configured, you can ask a model to explain a specific finding or
propose a patch, scoped to that finding only.

```
┌───────────────┐   repo URL / ZIP    ┌──────────────────┐   version query   ┌──────────┐
│  Next.js 15   │ ──────────────────▶ │   FastAPI        │ ────────────────▶ │ OSV.dev  │
│  App Router   │ ◀── SSE progress ── │   rule engine    │                   └──────────┘
│  TypeScript   │                     │                  │   finding + code  ┌──────────┐
└───────────────┘ ◀── report JSON ─── └──────────────────┘ ────────────────▶ │  Gemini  │
                                              │                              └──────────┘
                                              ▼
                                        ┌──────────┐
                                        │ Postgres │
                                        └──────────┘
```

---

## What it checks

| Rule | What it does |
|---|---|
| `dep/known-vulnerability` | Resolves versions from the lockfile and queries **OSV.dev**. Direct and transitive, grouped per package with real CVE/GHSA identifiers. |
| `dep/react-dom-mismatch` | Compares resolved majors, not spec strings. |
| `dep/no-lockfile` | Missing lockfile means non-reproducible installs. |
| `security/hardcoded-secret` | Provider-shaped tokens (AWS, GitHub, Stripe, Slack, private keys, JWTs, DB URLs) plus entropy-checked assignments, across all files. Values are redacted in output. |
| `security/env-not-ignored` | `.env` present but not covered by `.gitignore`. |
| `react/missing-list-key` | `.map()` rendering JSX with no `key`, evaluated per call site. |
| `react/array-index-key` | Index used as a key. |
| `react/dangerously-set-inner-html` | XSS surface, flagged for review. |
| `quality/long-file`, `quality/long-function`, `quality/deep-nesting`, `quality/todo-markers` | Structural metrics measured over source with comments and string literals removed. |
| `config/*` | Linter, tests, CI, TypeScript `strict`, README — each gated on the detected stack. |

Every finding carries a **confidence** level. Heuristic matches say so rather
than presenting a guess as a certainty.

## What changed since last time

Analyse a repository twice and the second report says what moved: how many
findings were resolved, how many are new, and which. Findings carry a
rule-supplied fingerprint that survives the edits which are not the point — a
dependency version bump, a line count changing, code inserted above — so the
comparison reports the two things that actually changed rather than the dozen
that merely look different.

The comparison is computed when the report is created and stored on it, so a
shared report keeps saying what it said when you shared it.

## Opening the file

Every finding links to its line in a real file view, with the tree beside it and
findings marked in the gutter. Repository source is re-fetched from GitHub
pinned to the exact commit that was analysed, so line 47 is the line the rule
saw; uploaded archives keep their source, because nothing can re-fetch it.

## Accepting findings

Some findings are real and you are going to live with them anyway — a key in a
test fixture, a long file nobody is going to split this quarter. Signed in, you
can mark one **Not an issue** with a reason, and it stops appearing on every
future analysis of that repository.

It is keyed on the finding's fingerprint rather than the report, so it survives
re-runs; it is never silent, since the count stays on screen with a toggle to
reveal what was accepted; and it is reversible without re-analysing. The score
is shown both ways — adjusted, with the analysed figure beside it — because a
number that quietly absorbed its own exceptions could not be checked.

## Scoring

A weighted, saturating score with a per-category breakdown the UI explains.
Security and dependency issues are judged on absolute count; quality scales
sub-linearly with project size, so a large codebase is neither excused nor
automatically condemned. Findings are weighted by severity **and** confidence.

---

## Running locally

Requirements: **Node 20+**, **Python 3.12+**.

### Backend

```bash
cd vantage-backend
python -m venv menv && menv/Scripts/activate   # Linux/macOS: source menv/bin/activate
pip install -r requirements.txt
cp .env.example .env                            # optional — see below
python -m uvicorn app.main:app --reload --port 5000
```

API docs at <http://127.0.0.1:5000/docs>.

### Frontend

```bash
cd vantage-frontend
npm install
cp .env.example .env.local
npm run dev
```

App at <http://localhost:3000>.

### It runs with no configuration at all

Neither the AI key nor the database is required. Without them:

- **No `GEMINI_API_KEY`** — analysis is unaffected. Explain / Propose fix /
  Generate test render **disabled with the reason stated**. No canned responses
  are ever substituted for a model.
- **No `DATABASE_URL`** — reports are held in memory and cleared on restart.
  `/api/health` and the UI say so explicitly.
- **No sign-in configuration** — public repositories still analyse. The sign-in
  control renders **disabled with the reason shown**, naming the missing
  variables, rather than being hidden.

## Sign-in

Optional, and worth it for three concrete reasons:

- **Reports become yours.** Without sign-in, `GET /api/reports` lists every
  report the server holds to every caller. Signed in, History shows only your
  analyses. Anonymous reports stay reachable by their unguessable URL — they are
  simply never enumerated.
- **Your GitHub rate limit, not the server's.** 5000 requests an hour instead of
  a shared 60. Commit-churn analysis spends one request per file carrying a
  finding, so the shared budget runs out quickly.
- **Private repositories**, if you separately grant it.

Sign-in asks for `read:user` only. `repo` — which GitHub scopes as read **and
write** to every private repository you own — is requested exclusively through a
separate opt-in on the Settings page.

Setting it up: create an OAuth App at
<https://github.com/settings/developers> with callback
`<your-origin>/api/auth/github/callback`, then fill the four frontend variables
and the three backend ones. Both `.env.example` files carry the generation
commands for the shared secrets.

## Configuration

### Backend (`vantage-backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | no | From [AI Studio](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | no | Default `gemini-3.6-flash`. Free-tier quota is **per model** — if you get 429s, switching model is usually faster than waiting for a reset. `pro` models are generally unavailable on the free tier. |
| `DATABASE_URL` | no | Postgres via **asyncpg**: `postgresql+asyncpg://user:pass@host/db`. |
| `GITHUB_TOKEN` | no | Raises the GitHub API limit from 60/hr to 5000/hr, and allows private repos. Worth setting for a deployed instance, where the IP is shared. |
| `CORS_ORIGINS` | no | Comma-separated frontend origins. |
| `GITHUB_CLIENT_ID` | no | Sign-in. Same value as the frontend. |
| `INTERNAL_API_SECRET` | no | Sign-in. **Must match the frontend exactly.** |
| `TOKEN_ENCRYPTION_KEY` | no | Sign-in. Fernet key encrypting stored GitHub tokens. |

Sign-in needs all three of the above **plus `DATABASE_URL`**. With any missing,
`/api/health` says which.

`OSV_ENABLED` (default true) turns off vulnerability scanning entirely. Archive
and analysis limits (`MAX_EXTRACTED_BYTES`, `MAX_FILE_COUNT`,
`MAX_COMPRESSION_RATIO`, `MAX_PATH_DEPTH`, `MAX_FINDINGS`, …) and the AI circuit
breaker settings are documented in
[`vantage-backend/README.md`](https://github.com/Asmodeus14/vantage-backend#configuration).

### Frontend (`vantage-frontend/.env.local`)

| Variable | Notes |
|---|---|
| `BACKEND_URL` | Server-side only. Used by Server Components and route handlers; never reaches the browser. |
| `NEXT_PUBLIC_BACKEND_URL` | Sent to the browser. Needed for the two things that cannot be proxied: the **SSE progress stream** (serverless buffers streaming responses) and the **ZIP upload** (serverless request bodies are capped at a few MB). |
| `GITHUB_CLIENT_ID` | Sign-in. Same value as the backend. |
| `GITHUB_CLIENT_SECRET` | Sign-in. Server-side only; the backend deliberately never reads it. |
| `INTERNAL_API_SECRET` | Sign-in. **Must match the backend exactly.** |
| `SESSION_SECRET` | Sign-in. Signs the OAuth `state`. |

## Testing

```bash
cd vantage-backend  && python -m pytest -q       # 244 tests
cd vantage-frontend && npm run test              # 131 tests
                       npm run typecheck
                       npm run lint
                       npm run build
```

Counts go stale; regenerate with `python -m pytest --collect-only -q | tail -1`
and the Vitest summary line.

The backend suite includes regression tests for archive path traversal
(ZIP **and** tar), symlink and special-file entries, decompression bombs, the AI
provider's circuit breaker, prompt-injection containment, and the report
ownership matrix. It runs against a deliberately unconfigured service — an
autouse fixture blanks ambient environment variables, so results do not depend
on whose machine it runs on.

The frontend suite covers the markdown renderer (including XSS), the chart
maths and their accessible fallbacks, OAuth state signing and the open-redirect
guard, and the report panels.

## Security notes

- **Archive extraction** applies one containment policy to both ZIP and tar
  rather than relying on per-format stdlib behaviour. Verified on Python 3.12:
  `tarfile.extractall()` with the default filter *does* let `../../x` escape,
  and tar is the primary ingestion path. Symlinks and special files are refused;
  size, file-count and compression limits are enforced *during* streaming.
- **The AI endpoint cannot be used as a general-purpose model proxy.** The
  client sends a report id, a finding id and one value from a closed enum. There
  is no free-text parameter — prompts are assembled server-side from stored
  analysis data.
- **Analysed source is treated as hostile.** It is fenced with a per-request
  random sentinel, the model is instructed not to obey it, output is
  format-validated, and proposed fixes are diffs a human reviews. Vantage
  never writes to your working tree.
- Secrets are never echoed back: detected values are redacted before display.
- **Report access.** Ids are `secrets.token_urlsafe(9)`, so a report URL is an
  unguessable capability — which is what makes it shareable. Listing is scoped
  to the owner; deletion requires ownership, and anonymous reports cannot be
  deleted through the API at all, since there is no account to authorise
  against.
- **Stored GitHub tokens are encrypted at rest** with a key held only by the
  backend, and sessions are stored as SHA-256 hashes rather than raw tokens.

## Deployment

**Backend → Render.** `render.yaml` is committed; its start command runs
migrations before uvicorn. Set `GEMINI_API_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`,
`CORS_ORIGINS`, `GITHUB_CLIENT_ID`, `INTERNAL_API_SECRET` and
`TOKEN_ENCRYPTION_KEY` in the dashboard.

**Frontend → Vercel.** Set `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `INTERNAL_API_SECRET` and
`SESSION_SECRET`.

Omitting the sign-in variables is supported — the app runs and says sign-in is
unconfigured — but omitting them *by accident* is the likely mistake, so check
`/api/health` after deploying.

Free tiers sleep when idle; the UI reports a waking backend rather than
appearing hung.

## Documentation

- [`docs/PRODUCT_AUDIT.md`](docs/PRODUCT_AUDIT.md) — audit of the previous version and why it was rebuilt
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the browser side
- [`vantage-backend/docs/ARCHITECTURE.md`](https://github.com/Asmodeus14/vantage-backend/blob/master/docs/ARCHITECTURE.md) — rule engine, persistence, security model
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — known limitations and what's next

## Keyboard

| Shortcut | Action |
|---|---|
| `⌘/Ctrl K` | Command palette |
| `/` | Focus the findings filter |
| `j` / `k` | Next / previous finding |
| `Esc` | Close palette or dialog |

## Licence

MIT.
