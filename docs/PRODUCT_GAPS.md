# Gaps

What Vantage genuinely lacks, from the production audit. Ordered by whether it
blocks calling the product production-ready, not by how interesting it is.

Nothing here is a feature added to lengthen a list. Each item is either a
measured problem or a stated consequence of the free-tier constraint.

---

## Critical

Fix before running this for other people.

### 1. No public-repository guard on the server token

`_credentials_for` (`analyze.py:82`) falls back to the server's GitHub token
whenever nobody is signed in, and **nothing checks repository visibility**. With
a correctly scoped token this is safe. With a classic `repo` PAT, any anonymous
visitor could analyse a private repository and then read its files through the
file viewer, which serves whole files.

Right now the token's scope is the only boundary. It should not be.

**Fix:** before analysing with *server* credentials, read the repository's
`private` flag and refuse when the caller is anonymous. Roughly 20 lines in
`ingest/github.py` plus a test. It costs one extra API call on a path that
already makes several, and it means a mis-scoped token cannot leak anything —
which is what makes it safe to say in `SECURITY.md` that a public instance
cannot read private code.

### 2. No data retention

Nothing prunes `reports` or `source_blobs`. Measured: reports are ~10 kB each,
so growth is slow; an upload stores up to 8 MB gzipped, so a few hundred uploads
would approach Neon's free storage allowance.

**Not implemented deliberately** — automatically deleting someone's reports is a
product decision, not a technical one, and getting it wrong destroys data.

**Proposal, in order of safety:**

1. **Prune blobs, not reports.** Source is a cache: `StoredSourceProvider`
   already has an "the source for this upload was not kept" path, so its absence
   degrades to a sentence rather than a broken page. Keep blobs for the newest
   *N* uploads per owner, dropped oldest-first when a new upload arrives.
2. **Then, if needed, prune anonymous reports** older than some window. Anonymous
   reports have no account to notify and are already unlisted.
3. **Never silently prune an owned report.** If that becomes necessary, it needs
   a visible retention policy in the UI first.

Step 1 alone removes the growth risk, because reports are the slow part.

---

## Important

Materially improves quality; not blocking.

### 3. The expired-session sweep is untested

The sweep added in this pass has no test, because the suite runs without a
database — deliberately, so results do not depend on whose machine it runs on.

**Fix:** an aiosqlite-backed fixture for the handful of tests that genuinely
need a database. `aiosqlite` is already a dependency and `create_all` already
runs for SQLite. This would also unlock testing `PostgresReportStore` and
`PostgresSuppressionStore`, which are currently only exercised by their
in-memory twins — the exact gap that let the `bindparam` bug reach live
Postgres during this audit.

### 4. Gemini usage is unmeasured

Context is bounded and prompts are server-assembled, so cost is structurally
controlled — but nothing records what a call actually costs. "Token efficient"
is an argument, not a measurement.

**Fix:** log prompt and response character counts per action at INFO. No
metrics platform, no new dependency; enough to see whether the 160-line window
is the right size.

### 5. Range-declared Python projects are not scanned

An exact version is required to query OSV. Python reads `poetry.lock` and `==`
pins. A project declaring only `fastapi>=0.115` gets its dependencies listed but
no advisories. Measured on the API's own repository: 18 collected, 0 resolvable.

**Fix:** parse `Pipfile.lock` and `uv.lock`, and `pip freeze`-style requirements.

### 6. Sign-in is unverified in Safari and Firefox strict mode

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
