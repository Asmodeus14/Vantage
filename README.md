# Vantage

**Point it at a repository and it tells you what is wrong, exactly where.**

Paste a GitHub URL. Vantage fetches the source, runs a rule engine over it, and
returns a scored report where every finding is anchored to a file and line with
the offending code shown beside it — known vulnerabilities from real advisory
data, committed credentials, correctness bugs, and structural problems.

> **This is the web client.** The rule engine, the API and the database live in
> [`vantage-backend`](https://github.com/Asmodeus14/vantage-backend). You need
> both running to use Vantage; see [Running it locally](#running-it-locally).

```
┌───────────────┐   repo URL / ZIP    ┌──────────────────┐   version query   ┌──────────┐
│  Next.js 15   │ ──────────────────▶ │   FastAPI        │ ────────────────▶ │ OSV.dev  │
│  App Router   │ ◀── SSE progress ── │   rule engine    │                   └──────────┘
│  TypeScript   │                     │                  │   finding + code  ┌──────────┐
└───────────────┘ ◀── report JSON ─── └──────────────────┘ ────────────────▶ │  Gemini  │
   this repo                                  │                              └──────────┘
                                              ▼
                                        ┌──────────┐
                                        │ Postgres │
                                        └──────────┘
```

---

## What it finds

| Area | Checks |
|---|---|
| **Dependencies** | Known vulnerabilities via **OSV.dev** with real CVE/GHSA ids, direct and transitive. React/react-dom major mismatch. Missing lockfile. |
| **Secrets** | Provider-shaped tokens (AWS, GitHub, Stripe, Slack, private keys, JWTs, DB URLs) plus entropy-checked assignments. `.env` not gitignored. Values are redacted everywhere they appear. |
| **React** | `.map()` without a `key`, array-index keys, `dangerouslySetInnerHTML`. |
| **Python** | Mutable default arguments, bare `except:`, `shell=True`, unsafe deserialisation. |
| **Structure** | Long files, long functions, deep nesting, TODO density — measured with comments and string literals stripped. |
| **Configuration** | Linter, tests, CI, TypeScript `strict`, README. |

Every finding carries a **confidence** level, and rules are gated on the
detected stack — a Python project is never told it is missing ESLint. The full
rule list and the reasoning behind each one is in the
[backend README](https://github.com/Asmodeus14/vantage-backend#readme).

**Dependency scanning needs an exact version.** npm reads the lockfile; Python
reads `poetry.lock` or `==` pins. A project declaring only ranges
(`fastapi>=0.115`) has its dependencies listed but not scanned, because a range
cannot be resolved without the index and guessing would report advisories for
versions nobody installed.

## What it does with them

### Tells you whether it is getting better

Analyse a repository twice and the second report says what moved: how many
findings were resolved, how many are new, and which. Findings carry a
rule-supplied fingerprint that survives the edits which are not the point — a
dependency version bump, a line count changing, code inserted above — so the
comparison reports the two things that actually changed rather than the dozen
that merely look different.

The comparison is computed when the report is created and stored on it, so a
shared report keeps saying what it said when you shared it.

### Opens the file

Every finding links to its line in a real file view, with the tree beside it and
findings marked in the gutter. Repository source is re-fetched from GitHub
pinned to the exact commit that was analysed, so line 47 is the line the rule
saw; uploaded archives keep their source, because nothing can re-fetch it.

### Lets you accept what you are living with

Some findings are real and you are going to live with them anyway — a key in a
test fixture, a long file nobody is splitting this quarter. Signed in, mark one
**Not an issue** with a reason and it stops appearing on every future analysis
of that repository.

Keyed on the fingerprint rather than the report, so it survives re-runs. Never
silent: the count stays on screen with a toggle to reveal what was accepted.
Reversible without re-analysing. The score is shown both ways — adjusted, with
the analysed figure beside it — because a number that quietly absorbed its own
exceptions could not be checked.

### Explains and proposes fixes

With an API key configured, ask a model to explain a finding, propose a patch,
or generate a test — each scoped to that one finding. Proposed fixes are diffs
you review; **Vantage never writes to your working tree.**

### Scores it

A weighted, saturating score with a per-category breakdown the UI explains.
Security and dependency issues are judged on absolute count; quality scales
sub-linearly with project size, so a large codebase is neither excused nor
automatically condemned. Findings are weighted by severity **and** confidence.

---

## Running it locally

Requires **Node 20+** and **Python 3.12+**. The two halves are separate
repositories, so clone both:

```bash
git clone https://github.com/Asmodeus14/vantage-backend
git clone https://github.com/Asmodeus14/vantage-frontend
```

**Backend**, in one terminal:

```bash
cd vantage-backend
python -m venv menv && menv/Scripts/activate   # Linux/macOS: source menv/bin/activate
pip install -r requirements.txt
cp .env.example .env                           # every variable is optional
python -m uvicorn app.main:app --reload --port 5000
```

**Frontend**, in another:

```bash
cd vantage-frontend
npm install
cp .env.example .env.local
npm run dev
```

App at <http://localhost:3000>, API docs at <http://127.0.0.1:5000/docs>.

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

## Configuration

This repository reads six variables. **Backend configuration is documented in
the [backend README](https://github.com/Asmodeus14/vantage-backend#configuration)**
rather than repeated here, because two copies drift.

| Variable | Notes |
|---|---|
| `BACKEND_URL` | Server-side only. Used by Server Components and route handlers; never reaches the browser. |
| `NEXT_PUBLIC_BACKEND_URL` | Sent to the browser. Needed for the two things that cannot be proxied: the **SSE progress stream** (serverless buffers streaming responses) and the **ZIP upload** (serverless request bodies are capped at a few MB). |
| `GITHUB_CLIENT_ID` | Sign-in. Same value as the backend. |
| `GITHUB_CLIENT_SECRET` | Sign-in. Server-side only; the backend deliberately never reads it. |
| `INTERNAL_API_SECRET` | Sign-in. **Must match the backend exactly.** |
| `SESSION_SECRET` | Sign-in. Signs the OAuth `state`. |

## Sign-in

Optional, and worth it for three concrete reasons:

- **Reports become yours.** Signed out, History shows only reports that belong
  to nobody. Signed in, it shows yours. Anonymous reports stay reachable by
  their unguessable URL — they are simply never enumerated.
- **Your GitHub rate limit, not the server's.** 5000 requests an hour instead of
  a shared 60. Commit-churn analysis spends one request per file carrying a
  finding, so the shared budget runs out quickly.
- **Private repositories**, if you separately grant it.

Sign-in asks for `read:user` only. `repo` — which GitHub scopes as read **and
write** to every private repository you own — is requested exclusively through a
separate opt-in on the Settings page.

**Setting it up:** create an OAuth App at
<https://github.com/settings/developers> with callback
`<your-origin>/api/auth/github/callback`, then fill the six variables above and
the three on the backend. Both `.env.example` files carry the generation
commands for the shared secrets.

The OAuth exchange happens on *this* server, not the API, so the session cookie
is first-party — a cookie set by the API would be third-party in production and
blocked by Safari and by Firefox in strict mode. See
[`SECURITY.md`](SECURITY.md).

## Testing

```bash
npm run test        # 131 tests
npm run typecheck
npm run lint
npm run build       # the one that catches Server/Client Component mistakes
```

All four run in CI on every push and pull request. The suite covers the markdown
renderer (including XSS), the chart maths and their accessible fallbacks, OAuth
state signing and the open-redirect guard, the file viewer, and the report
panels.

The backend has its own suite of 302 tests — see its README. Counts go stale;
regenerate from the Vitest summary line.

## Deployment

**Frontend → Vercel.** Set `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `INTERNAL_API_SECRET` and
`SESSION_SECRET`. Leave the Output Directory unset — Next.js emits `.next`.

**Backend → Render**, covered in its own README.

Omitting the sign-in variables is supported — the app runs and says sign-in is
unconfigured — but omitting them *by accident* is the likely mistake, so check
`/api/health` after deploying.

Free tiers sleep when idle; the UI reports a waking backend rather than
appearing hung.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the browser side is put
  together, and why
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — known limitations and what is next
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — setup, conventions, and the things that
  are deliberate rather than accidental
- [`SECURITY.md`](SECURITY.md) — reporting a vulnerability, and the XSS and
  cookie model
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`docs/PRODUCT_AUDIT.md`](docs/PRODUCT_AUDIT.md) — audit of the version this
  replaced, and why it was rebuilt
- [Backend architecture](https://github.com/Asmodeus14/vantage-backend/blob/master/docs/ARCHITECTURE.md)
  — rule engine, finding identity, persistence, security model

## Keyboard

| Shortcut | Action |
|---|---|
| `⌘/Ctrl K` | Command palette |
| `/` | Focus the findings filter |
| `j` / `k` | Next / previous finding |
| `Esc` | Close palette or dialog |

## Licence

[MIT](LICENSE).
