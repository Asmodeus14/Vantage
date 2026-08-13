# Gaps

What Vantage genuinely lacks, from the production audit. Ordered by whether it
blocks calling the product production-ready, not by how interesting it is.

Nothing here is a feature added to lengthen a list. Each item is either a
measured problem or a stated consequence of the free-tier constraint.

---

## Closed

### Rules reported things that were not true — *fixed*

Validating each rule family against real repositories rather than fixtures
found three defects, roughly sixty false findings between them: the secret
detector treating any expression assigned to a credential-shaped name as a
credential, `react/missing-list-key` reading six lines past the callback,
and `quality/deep-nesting` counting JSX braces as control flow.

Two narrower ones followed: `quality/long-function` counted markup towards a
threshold whose rationale is about branching (24 findings to 3), and
`config/no-linter` was gated to Node, so a Python project with no linter was
never told (this API's own repository).

Every failure was a heuristic reading nearby text instead of the construct it
claimed to measure. All passed unit tests with tidy fixtures.

### Stored source grew without bound — *fixed*

Nothing pruned `source_blobs`, and an upload keeps up to 8 MB gzipped, so a few
hundred would approach a small managed database's whole allowance.

Now bounded by total bytes rather than a per-owner count — *N* uploads per
account is unbounded in accounts, and the constraint that actually exists is
disk. Revision `0007` adds the timestamp the eviction sorts on, because
`report_id` is a random token carrying no time and the report row may already be
gone. Eviction takes whole reports: half a project is a broken tree, which is
worse than an absent one that says so, and `StoredSourceProvider` already has
the sentence for it.

Pruning runs after a write, not before, so an oversized upload cannot slip in
over the ceiling — and a failure there is logged rather than failing the upload,
since the source is stored by then and the cost is being briefly over budget.

### Anonymous callers could reach private repositories — *fixed*

`_credentials_for` fell back to the server's GitHub token for anonymous callers
and nothing checked repository visibility, so the token's scope was the only
boundary between a visitor and someone's private code — which the file viewer
serves whole files of.

Now guarded in two places. **Ingestion** refuses a private repository unless the
credentials came from a signed-in user, at no extra cost: `fetch_repository`
already reads the metadata for its size check and `private` is in the same
response. **Reading** refuses too, from a `private` flag recorded on
`SourceInfo` at analysis time rather than a fresh API call — a guard that needed
the network would fail open exactly when the rate limit is exhausted.

The second half covers what the first cannot: a signed-in user analysing their
own private repository and sharing the link. The report stays readable; its
source does not.

---

---

## Important

Nothing is blocking any more. These materially improve quality.

### 1. The expired-session sweep is untested

The sweep added in this pass has no test, because the suite runs without a
database — deliberately, so results do not depend on whose machine it runs on.

**Fix:** an aiosqlite-backed fixture for the handful of tests that genuinely
need a database. `aiosqlite` is already a dependency and `create_all` already
runs for SQLite. This would also unlock testing `PostgresReportStore` and
`PostgresSuppressionStore`, which are currently only exercised by their
in-memory twins — the exact gap that let the `bindparam` bug reach live
Postgres during this audit.

### 2. Gemini usage is unmeasured

Context is bounded and prompts are server-assembled, so cost is structurally
controlled — but nothing records what a call actually costs. "Token efficient"
is an argument, not a measurement.

**Fix:** log prompt and response character counts per action at INFO. No
metrics platform, no new dependency; enough to see whether the 160-line window
is the right size.

### 3. Range-declared Python projects are not scanned

An exact version is required to query OSV. Python reads `poetry.lock` and `==`
pins. A project declaring only `fastapi>=0.115` gets its dependencies listed but
no advisories. Measured on the API's own repository: 18 collected, 0 resolvable.

**Fix:** parse `Pipfile.lock` and `uv.lock`, and `pip freeze`-style requirements.

### 4. Sign-in is unverified in Safari and Firefox strict mode

The consent step needs a human. This is the one failure mode that passes every
Chrome test, because the first-party cookie design exists specifically to
survive third-party cookie blocking — which only those browsers enforce.

---

## Nice to have

- **Syntax highlighting in finding snippets.** Shiki is wired for AI and
  markdown output; `code-snippet.tsx` still renders plain monospace. The file
  viewer is highlighted, so the inconsistency is visible.
- **Structured logging.** Logs are useful and free of secrets, but plain text.
  JSON lines would make them greppable without adding a dependency.
- **A retention notice in the UI**, if any pruning is introduced.

---

## Future — does not fit the current constraint

Recorded so the upgrade path is obvious, not as a plan.

- **Distributed rate limiting.** Needs shared state. The current limiter is
  process-local across two workers and is described that way rather than
  overstated.
- **Out-of-process job queue.** Analysis jobs live in the web process. Correct
  for one instance; a second would not find another's job.
- **Reachability analysis for transitive advisories.** The difference between
  "your lockfile mentions a vulnerable package" and "your code can reach it" is
  most of the noise in dependency scanning — and a substantial piece of work.
- **PR/CI mode.** A GitHub Action commenting only on what a pull request
  introduced. The delta already produces the right shape for it.
