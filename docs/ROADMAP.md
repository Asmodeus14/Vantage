# Roadmap & known limitations

Written honestly: these are things that genuinely don't work yet or work in a
constrained way, not aspirational marketing.

## Known limitations

| Limitation | Detail | Fix |
|---|---|---|
| **Jobs are in-process** | An analysis job lives in the memory of the web process that started it. Correct for one instance; a second instance would not find the job. | Move the queue to Redis or Postgres `LISTEN/NOTIFY`. |
| **AI actions still see only a snippet** | The file viewer can now read whole files, but `routers/ai.py` still builds its prompt from the finding's ±3-line snippet, so *Propose fix* returns `INSUFFICIENT_CONTEXT` on whole-file findings. The plumbing to fix this exists. | Have the AI router read through `SourceProvider` too. |
| **A repository's source can disappear** | It is re-fetched from GitHub pinned to the analysed commit, so the viewer breaks if the repository is deleted, made private, or force-pushed. The chosen trade for not storing every repository's source. | The page says which of those happened; storing blobs for repositories too is the fix, at a storage cost. |
| **Findings snippets are not highlighted** | Shiki is fully wired for AI and markdown output, but `components/report/code-snippet.tsx` still renders plain monospace with the offending line marked. | Reuse `lib/highlighter.ts` in the snippet component. |
| **Some backend tests touch the network** | Two API tests start a real analysis in a background task, which reaches GitHub/OSV. They pass, but they make the suite slower and weather-dependent. | Inject a fake runner in those tests. |
| **JS/TS-weighted rules** | Project detection is multi-language, but most correctness rules target JS/TS/React. Python and Go get structural and secret checks only. | Add per-ecosystem rule packs. |
| **Transitive dependency noise** | Transitive advisories are reported only at high/critical and downgraded one level, which is a heuristic compromise rather than reachability analysis. | Parse the lockfile dependency graph to determine whether the vulnerable path is actually reachable. |
| **Rate limiting is per-IP, in-memory** | Resets on restart and is per-instance. Signed-in users share the anonymous bucket. | Redis-backed limiter, keyed on the session when present. |
| **Some findings still churn between runs** | Rules emitting several findings per file with nothing to tell them apart — `react/array-index-key`, `react/missing-list-key` — key on `line`, so inserting code above one reads as resolved-plus-new. Renaming a file has the same effect for every rule. | Accepted, not fixed: there is no natural discriminator, and rename detection is a larger change. |
| **A signed-in user's ZIP upload is attributed anonymously** | The upload posts directly to the API to clear the serverless body cap, so it cannot carry the session cookie. | A single-use upload ticket issued by the frontend. |
| **Sign-in is untested against real GitHub** | The consent step needs a human. The third-party-cookie failure mode passes every Chrome test. | Verify in Safari and Firefox strict mode. |

## Next features, in rough value order

1. **Wider context for AI actions.** `SourceProvider` can read whole files now;
   the AI router still builds prompts from the ±3-line snippet. Small change,
   removes the `INSUFFICIENT_CONTEXT` answer.
2. **Reachability for transitive advisories.** The difference between "your
   lockfile mentions a vulnerable package" and "your code can actually reach it"
   is most of the signal-to-noise problem in dependency scanning.
3. **PR/CI mode.** A GitHub Action posting findings as review comments on
   changed lines. The engine already produces exactly the right shape, and the
   delta gives it the "only comment on what this PR introduced" behaviour that
   makes such a bot tolerable.
4. **Per-ecosystem rule packs.** Python (`requirements`/`pyproject` + PyPI
   advisories) is the obvious next one.
5. **Streaming AI responses.** The provider already supports `stream()`; the
   endpoint returns complete responses. Streaming would make *Explain* feel
   immediate.

## Shipped since this document was written

- **Re-run and compare.** Findings carry a rule-supplied `fingerprint`, and each
  report stores a `delta` against the previous analysis of the same repository.
  See "Finding identity" in the backend architecture document.
- **File viewer.** `/r/[id]/f/[...path]` with a tree, per-file finding counts and
  gutter markers. Repository source is re-fetched pinned to the analysed commit;
  uploads store theirs. See "Reading source after the fact".
- **Baselines.** Findings can be accepted, per repository, so a report stops
  reporting what someone has already decided to live with. The adjusted score is
  cached on the report row so History and the trend chart show the same number
  as the report they link to. See "Accepted findings".

## Deliberately not planned

- **A general chat interface.** AI actions are scoped to a finding on purpose:
  it keeps context honest and stops the endpoint becoming a free model proxy.
- **Writing to your repository.** Proposed fixes stay diffs you review. This is
  also the backstop that keeps a prompt injection from becoming code execution.
- **Auto-fix on push.** Same reason.
