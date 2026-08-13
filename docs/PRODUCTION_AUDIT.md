# Production audit

An audit of Vantage against its actual deployment target: Vercel free, Render
free, Neon free, Gemini free tier. Everything below was measured against the
running system, not inferred from the code.

**Scope note.** This was one pass, not two. Where a finding was fixed during the
pass, the "after" score reflects a verified change and the fix is named. Where
it was not, the score is unchanged and the reason is stated. There is no
separate "final" document, because writing an initial audit and then a final one
from a single session would be theatre.

---

## Executive summary

**Good.** The security model is the strongest part and was designed rather than
retrofitted: archive containment covers ZIP and tar under one policy, model
input is fenced and output validated, the AI endpoint takes a closed enum with
no free-text parameter, secrets are redacted before storage, GitHub tokens are
encrypted at rest and sessions stored as hashes. Test coverage is real — 310
backend and 131 frontend tests, run in CI, covering the authorisation matrix and
the containment paths specifically. Degradation is honest throughout: every
absent dependency is reported rather than hidden.

**Weak.** Reports still accumulate — slowly, at ~10 kB each — though stored
source and expired sessions are now bounded. Rate limiting is
process-local while Render runs two workers, so the effective limit is roughly
double what is configured. Some of the free-tier behaviour is documented in
prose that a deployer will not read at the moment they need it.

**Dangerous.** One item, now closed. The server GitHub token had no scope
guard: `_credentials_for` falls back to it for anonymous callers and nothing
checked repository visibility, so a token with private access would have let any
visitor read private code through the file viewer. Scoping the token was the
first fix; the code no longer depends on that having been done.

**Missing.** Data retention, and any measurement of Gemini token usage.

**Maturity.** Beyond a portfolio project; short of something to run for other
people unattended. The gap is operational, not architectural.

---

## Scores

Measured, not impressionistic. `Before` is the state at the start of this pass.

| Category | Before | After | What moved it |
|---|:--:|:--:|---|
| Product — clarity, UX, usefulness | 8 | 8 | Unchanged in this pass |
| Frontend — architecture, quality, a11y | 8 | 8 | Already sound; bundle verified healthy |
| Backend — architecture, API design | 8 | 8 | Unchanged |
| Database — schema, indexes, queries | 6 | 8 | N+1 fixed; stored source now bounded by a byte ceiling |
| AI integration | 7 | 7 | Correct and bounded; token usage still unmeasured |
| Security | 8 | 9 | Private repositories guarded in code, not only by token scope |
| Performance | 7 | 8 | One round-trip instead of N on every suppression |
| Reliability | 6 | 8 | Neither sessions nor stored source grow unbounded |
| Testing | 8 | 8 | +8 tests; the session sweep is untested (see gaps) |
| Documentation | 8 | 9 | Free-tier architecture documented with measurements |
| Free-tier efficiency | 6 | 8 | Fewer round-trips; sessions and stored source both bounded |
| **Overall** | **7** | **8** | |

Not 10 anywhere, and deliberately so. A 10 would mean retention, distributed
rate limiting and measured AI cost — none of which is true.

---

## What was measured

### Database (live Neon)

```
total size                8232 kB
reports                   24 rows   376 kB   avg payload 10,151 bytes
sessions                   1 row     56 kB
source_blobs               0 rows    48 kB
max_connections          901        current connections: 10
```

**Connection pool is not a problem.** `pool_size=5, max_overflow=5` across two
workers is at most 20 connections against a ceiling of 901. No change needed —
and a pooled connection string would add a moving part for no benefit at this
size.

**569 sequential scans on `reports` is not a missing index.** With 24 rows the
planner correctly prefers a sequential scan; an index would be slower. The same
reasoning explains `ix_reports_owner_id` showing 0 scans. Both are correct for
the query patterns that exist and will be used as the table grows. Adding
indexes in response to those numbers would have been a mistake.

**`ix_sessions_expires_at` showed 0 scans** — and that one *was* a finding. See
below.

### Frontend bundle

```
shared by all             107 kB
/r/[id]                   212 kB First Load   (heaviest, richest page)
/r/[id]/f/[...path]       124 kB
/                         149 kB
```

Healthy. Shiki is genuinely lazy — it does not appear in any first load. No
bundle work was warranted, and none was done.

---

## Findings

### Fixed in this pass

**1. N+1 write on every suppression change** — *performance, confirmed*

`_refresh_effective_scores` issued one `UPDATE` per report, sequentially
awaited, up to the 100-report cap. Each is a network round-trip to Neon. One
click could block for seconds.

Now a single ORM bulk update by primary key — one `executemany`. Verified
against live Postgres: 8 rows in one round-trip. Test asserts one batched call
for eight reports rather than eight calls.

*Caught a second bug doing it:* the first implementation used a custom
`bindparam` WHERE clause, which passed the in-memory unit test and failed
against real Postgres with `InvalidRequestError`. Only running it live found
that.

**2. Expired sessions were never swept** — *reliability, confirmed*

`resolve_session` deletes an expired row only when that exact token is presented
again. A session that expires and is never used stays for ever. This is what
`ix_sessions_expires_at` was created for, and nothing used it — hence 0 scans.

The sweep now runs inside `create_session`, in the same transaction: the one
moment the table is known to be growing, and the only place available given
there is no scheduler on a free tier and the process sleeps when idle.

**3. Anonymous callers could reach private repositories** — *security, fixed*

`_credentials_for` fell back to the server token for anonymous callers and
nothing checked repository visibility. With a mis-scoped token, any visitor
could analyse private code and then read whole files through the viewer.

Guarded at both ends: analysis refuses a private repository without user
credentials, and reading refuses from a flag recorded at analysis time rather
than a fresh API call — because a guard needing the network fails open exactly
when the rate limit is exhausted. Four tests, including one asserting an
ordinary public report is untouched.

**4. Stored source grew without bound** — *free-tier risk, fixed*

Nothing pruned `source_blobs`; an upload keeps up to 8 MB gzipped. Now bounded
by a total-bytes ceiling, evicting oldest-first, whole reports at a time.
Revision `0007` adds the timestamp the ordering needs. Verified against live
Postgres: columns and index present, prune at the real budget correctly a no-op
on an empty table.

Bounded by bytes rather than a per-owner count deliberately — *N* uploads per
account is unbounded in accounts, and disk is the constraint that exists.

### Found, not fixed — with reasons

**5. Rate limiting is process-local while Render runs two workers**

`slowapi` keeps counters in memory. Two workers means roughly double the
configured limit, and a restart resets it. Genuinely unfixable within the
constraint — the alternatives all need shared state. Documented rather than
papered over, in `FREE_TIER_ARCHITECTURE.md`.

**6. Gemini token usage is unmeasured**

Context is bounded at 160 lines and prompts are assembled server-side, so the
cost is structurally controlled. But no counter records what a call actually
costs, so "efficient" is an assertion rather than a measurement.

### Checked and found clean

Worth recording so it is not re-audited:

- **No `console.log`** anywhere in frontend source.
- **No secrets in logs.** The two log lines mentioning secrets record that one
  was rejected, never a value.
- **No SQL injection surface.** Every query is SQLAlchemy Core or ORM with bound
  parameters; no string interpolation into SQL anywhere.
- **XSS.** `rehype-raw` is absent by design, `rehype-sanitize` runs on top, and
  Shiki only receives plain text off a hast node.
- **CORS** is an explicit allowlist with `allow_credentials=False`.
- **Health endpoint is cheap** — `/api/ping` touches nothing, `/api/health`
  caches its database probe for 15 seconds.
- **Connection pool** is appropriate (see above).
- **Bundle size** is healthy (see above).

---

## Free-tier reality

See [`FREE_TIER_ARCHITECTURE.md`](FREE_TIER_ARCHITECTURE.md) for the constraints
and what each one implies. The short version: the architecture already fits, and
the two places it strains — shared rate limiting and unbounded growth — are
documented rather than pretended away.
