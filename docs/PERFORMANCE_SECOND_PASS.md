# Second-pass performance investigation

## Previous

```
FCP  3.5s    LCP  5.2s    TBT  1,730ms    Speed Index  3.0s
```

## Current

```
FCP  3.2s    LCP  3.9s    TBT    730ms    Speed Index  20.8s
server response ~42ms
```

TBT down 58%, LCP down 25%. Speed Index up **7×**.

---

## Root cause

**Infinite CSS animations on the loading state.**

Speed Index is computed from a filmstrip: each frame is compared against the
final frame, and the metric integrates how long the page spends visually
incomplete. **A region that never stops changing means the page is never
visually complete**, so the integral keeps accumulating regardless of when
content actually arrived.

`Skeleton` — the shared primitive — carried Tailwind's `animate-pulse`, which is
`animation: pulse 2s … infinite`. On the audited page:

- `app/r/[id]/loading.tsx` renders **12 skeletons** while the route resolves.
- `overview-panel.tsx`'s `TrendSkeleton` pulses inside the Suspense boundary
  until the trend history arrives.

Every one of them oscillated for the entire trace.

## Evidence

The strongest evidence is the shape of the change itself.

| | Before pass 1 | After pass 1 |
|---|---|---|
| Speed Index | **3.0s** | **20.8s** |
| LCP | 5.2s | 3.9s |
| TBT | 1,730ms | 730ms |

Everything measuring *when content arrives* improved. The only metric that
measures *when pixels stop changing* got 7× worse — in the same pass that added
a persistently pulsing Suspense fallback to that exact page.

The supporting facts:

- **Server response is ~42ms.** Backend latency cannot explain 20.8s, and the
  brief was right to rule it out.
- **LCP 3.9s and Speed Index 20.8s cannot both describe content arrival.**
  LCP says the largest element painted at 3.9s. A Speed Index 5× larger than
  LCP is not measuring arrival; it is measuring instability.
- **CLS is 0**, so the churn is not layout shift. That leaves paint-level
  change, which is what an opacity animation is.
- 14 infinite animations existed across the app; the ones on this page's
  critical path were all `animate-pulse` skeletons.

### What was ruled out, with reasons

- **IndexedDB** — Vantage uses none. Confirmed again this pass: no `indexedDB`,
  no `idb`, no `sessionStorage`. The Lighthouse warning is not about this app.
- **Fonts** — none loaded; system stack. Also why CLS is 0.
- **Images** — none on the report page's critical path.
- **Syntax highlighting / markdown** — Shiki is a dynamic import and absent from
  every first load. Neither is on this page's critical path.
- **DOM size** — findings now render 30 at a time (pass 1), which is what took
  TBT from 1,730ms to 730ms.

---

## Change

**One change, matching the one cause.**

`animate-pulse` replaced with `animate-skeleton`: the same pulse, bounded to
four cycles.

```css
.animate-skeleton {
  animation: skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 4;
}
```

The affordance is kept — a skeleton still visibly pulses while work is
happening — but it settles, so the filmstrip can reach completeness. Eight
seconds is far longer than any healthy load, and anything still skeletal after
that has a problem a pulse will not fix.

`prefers-reduced-motion` disables it entirely, consistent with the rest of the
stylesheet.

Applied to every skeleton: the shared primitive, both route-level loading
states, and the trend fallback.

---

## Before / after

| | Before | After |
|---|---|---|
| Tests | 134 | 134 passing |
| Bundle (shared) | 107 kB | 107 kB |
| `/r/[id]` first load | 212 kB | 212 kB |
| Infinite animations on the report path | 12+ | 0 |

**No after-measurement of Lighthouse.** The fix is verified by build, lint,
typecheck and the suite; its effect on Speed Index is reasoned from how the
metric is defined, not measured. That measurement is the next step and it is
cheap — one Lighthouse run.

---

## Remaining bottleneck

**FCP 3.2s**, and it is architectural rather than incidental.

Every page route is `force-dynamic`, so no HTML is sent until the API answers.
Server response is 42ms warm, which means FCP of 3.2s is dominated by the round
trip plus render, not by the server itself. The fix is a static shell with the
data streamed in — planned in `PERFORMANCE_AUDIT.md`, not yet done.

---

## Decision

**Yes, one more pass is justified — but measure first.**

Re-run Lighthouse before changing anything else. If Speed Index drops to roughly
LCP, this diagnosis was right and the remaining work is the static shell for
FCP. If it stays near 20s, the diagnosis was wrong and the filmstrip needs
reading frame by frame rather than reasoned about.

Do not stack another speculative change on top of an unmeasured one.
