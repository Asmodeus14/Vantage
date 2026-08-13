# Running Vantage on free infrastructure

Vantage targets Vercel free, Render free, Neon free and Gemini's free tier. This
records what each constraint actually implies for the design, and where the
architecture strains against one.

**Quotas are deliberately not quoted.** Providers change them, and a number
written here would be wrong within months. What is recorded instead is the
*architectural implication*, which does not change, plus anything measured
against this deployment.

---

## Vercel — the web client

**Two request paths deliberately bypass the Next.js proxy**, and both are
consequences of the platform:

| Path | Why it goes direct to the API |
|---|---|
| `POST /api/analyze/upload` | Serverless request bodies are capped well below a project archive. |
| `GET /api/analyze/{job}/events` | Serverless buffers streaming responses, which would deliver every progress event at once when the job finished. |

The upload bypass is why **upload tickets** exist: that request cannot carry the
HttpOnly session cookie, so a narrow short-lived credential is attached instead.

**The OAuth exchange happens on this server**, which keeps the client secret off
the API and — more importantly — makes the session cookie first-party. A cookie
set by the API would be third-party in production and blocked by Safari and
Firefox strict mode.

**Measured bundle:** 107 kB shared, 212 kB on the report page, Shiki lazy-loaded
and absent from every first load. No optimisation warranted.

---

## Render — the API

**It sleeps.** The instance spins down after a period of inactivity and the cold
start is on the order of a minute. The client handles this by reporting a waking
backend rather than a network error.

`/api/ping` exists for uptime monitors and touches nothing. Pointing a monitor
at `/api/health` instead is a trap: it probes the database on a 15-second cache,
so a ping every few minutes always misses the cache, issues a real query, and
keeps the database from auto-suspending too — paying compute on two services to
keep one awake. This is documented in the API README.

**It runs more than one worker.** `render.yaml` starts uvicorn with `--workers
2`, and that has two consequences the code cannot design away:

- **Rate limiting is process-local.** `slowapi` keeps counters in memory, so the
  effective limit is roughly double the configured one, and a restart resets it.
  It still stops a single client hammering an endpoint, which is what it is
  for — but it is **not** distributed protection and is not described as such.
- **Anything stateful must be stateless.** The OAuth `state` is signed rather
  than stored, and upload tickets are Fernet tokens rather than rows, precisely
  because a callback can land on a different worker than the redirect.

**Analysis jobs live in the process that started them.** Correct for one
instance; a second instance would not find another's job. This is the clearest
thing that would need to change to scale, and it is recorded in the roadmap
rather than pre-solved.

**Startup does no network I/O** — no model probing, no eager database
connection. The engine is built on first use. This matters when the process is
being restarted regularly.

---

## Neon — the database

**Measured on this deployment:**

```
total size    8232 kB
reports       24 rows,  376 kB   avg payload ~10 kB
sessions       1 row
source_blobs   0 rows
connections   10 in use, ceiling 901
```

**The connection pool is not a concern.** `pool_size=5, max_overflow=5` across
two workers is at most 20 against a ceiling of 901. `pool_pre_ping=True` handles
Neon closing idle connections. A pooled connection string would add a moving
part for no benefit at this size.

**Listing never deserialises a payload.** Indexed columns carry everything a
listing needs, which is what keeps History cheap. It is also why the
suppression-adjusted score is cached on the row rather than computed on read.

**Storage is the real constraint, and stored source is now bounded.** Reports at
~10 kB grow slowly. `source_blobs` was the exposure — an upload keeps up to 8 MB
gzipped — and is now capped by a total-bytes ceiling, evicting oldest-first and
whole reports at a time. Bounded by bytes rather than a per-owner count on
purpose: *N* uploads per account is unbounded in accounts, while disk is the
constraint that actually exists.

Reports themselves are still unpruned. At ~10 kB each that is a slow problem,
and deleting someone's reports is a product decision rather than a technical
one.

**Sequential scans are not evidence of a missing index** at this size. With 24
rows the planner correctly prefers a scan. Indexes exist for the query patterns
that will matter as the table grows, and none was added speculatively.

**There is no scheduler.** No cron, and the process sleeps. Anything periodic
has to ride along with a request, which is why the expired-session sweep runs
inside `create_session` — the one write known to grow that table.

---

## Gemini

**Structurally bounded rather than trusted:**

- Context is capped at `MAX_CONTEXT_LINES` and `MAX_CONTEXT_CHARS`, centred on
  the finding so truncation cannot remove the lines it points at.
- Prompts are assembled server-side from stored analysis. The client sends a
  report id, a finding id and one value from a closed enum — there is no
  free-text parameter, so the endpoint cannot become a general model proxy.
- Results are cached per `(finding, action)`, so re-opening a finding costs
  nothing.
- A **circuit breaker** opens after consecutive failures and stays open for a
  cooldown, so a provider outage does not turn into a retry storm.
- `/api/health` reads provider state from local circuit-breaker state and
  **never calls the model** — the previous version called `generate_content`
  on every health check while the client polled it, which is what exhausted the
  quota and left the feature permanently disabled.

**Free-tier quota is per model.** On repeated 429s, switching `GEMINI_MODEL` is
usually faster than waiting for a reset.

**Not measured:** no counter records what a call actually costs, so token
efficiency is a structural argument rather than a measurement.

---

## GitHub

Not infrastructure Vantage pays for, but the tightest limit in practice.

**Unauthenticated is 60 requests per hour, shared across the whole service.**
Commit-churn analysis spends one request per file carrying a finding, so a
single analysis can consume most of it. Observed on this deployment: the
Activity panel degraded to its rate-limit message and the file tree failed twice
before succeeding.

Setting `GITHUB_TOKEN` raises it to 5000/hour. **Scope it to public repositories,
read-only.** `_credentials_for` falls back to this token for anonymous callers,
so a token with private access would otherwise be the only thing standing
between a visitor and private code. The code no longer relies on that: analysis
refuses a private repository without user credentials, and the file viewer
refuses from a flag recorded at analysis time. Scope the token anyway — defence
in depth means both.

Signed-in users spend their own budget, not the server's — which is most of why
sign-in exists.

---

## What does not fit, honestly

| Problem | Why it exists | Current position | Paid-tier answer |
|---|---|---|---|
| Rate limiting is per-process | Two workers, no shared store | Documented, not overstated | Redis-backed limiter keyed on session |
| Jobs are in-process | No queue available | Correct for one instance | Redis or Postgres `LISTEN/NOTIFY` |
| Reports are not pruned | Deleting user data is a product decision | Stored source *is* bounded; reports grow at ~10 kB | A visible retention policy |
| Cold starts | Free instances sleep | Client reports a waking backend | Always-on instance |
| AI cost unmeasured | No metrics sink | Structurally bounded | Any observability platform |

None of these is faked. Each is a real consequence of the constraint, and the
paid-tier answer is recorded so the upgrade path is obvious when it is worth
taking.
