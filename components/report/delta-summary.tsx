"use client";

import { SEVERITY_META } from "@/lib/severity";
import { cn, formatRelativeTime, pluralise } from "@/lib/utils";
import type { FindingDelta, Report } from "@/lib/types";

/**
 * What changed since the last analysis of this repository.
 *
 * "Is it getting better?" is the question a maintainer actually has, and a
 * total finding count cannot answer it — 47 findings is meaningless without
 * knowing whether it was 52 or 41 last week.
 *
 * Rendered as a sentence rather than a set of stat cards. Three numbers do not
 * need three bordered boxes, and the comparison only means anything read as a
 * whole.
 */
export function DeltaSummary({
  report,
  onViewNew,
}: {
  report: Report;
  /** Jump to Findings showing only what is new. */
  onViewNew: () => void;
}) {
  const delta = report.delta;
  if (!delta) return null;

  const newCount = delta.new.length;
  const resolvedCount = delta.resolved.length;

  // Nothing changed at all. Worth saying — "settled" is an answer — but not
  // worth a section.
  if (newCount === 0 && resolvedCount === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Nothing has changed since the analysis{" "}
        {formatRelativeTime(delta.previous_created_at)}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        Since the analysis {formatRelativeTime(delta.previous_created_at)}
        {": "}
        {resolvedCount > 0 && (
          <span className="text-fg">
            {resolvedCount} {pluralise(resolvedCount, "finding")} resolved
          </span>
        )}
        {resolvedCount > 0 && newCount > 0 && ", "}
        {newCount > 0 && (
          <button
            type="button"
            onClick={onViewNew}
            className="rounded text-fg underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) hover:decoration-fg"
          >
            {newCount} new
          </button>
        )}
        {delta.unchanged > 0 && `, ${delta.unchanged} unchanged`}.
      </p>

      <NewRuleCaption report={report} delta={delta} />
      <ResolvedList delta={delta} />
    </div>
  );
}

/**
 * A rule added between the two runs reports everything it finds as new, which
 * is true and misleading at once — the code may not have changed at all. Saying
 * so is the difference between a comparison people trust and one they learn to
 * discount.
 */
function NewRuleCaption({ report, delta }: { report: Report; delta: FindingDelta }) {
  if (delta.new_rules.length === 0) return null;

  const added = new Set(delta.new_rules);
  const fromNewRules = report.findings.filter(
    (finding) => added.has(finding.rule_id) && delta.new.includes(finding.fingerprint),
  ).length;

  if (fromNewRules === 0) return null;

  return (
    <p className="text-xs text-fg-subtle">
      {fromNewRules === 1
        ? "One of those is"
        : `${fromNewRules} of those are`}{" "}
      from {added.size === 1 ? "a rule" : `${added.size} rules`} that did not run
      last time — new to the analysis, not to the code.
    </p>
  );
}

/**
 * Resolved findings are absent from `report.findings` by definition, so they
 * have nowhere else to appear. Listed rather than merely counted, because
 * "4 resolved" invites the question "which ones?".
 */
function ResolvedList({ delta }: { delta: FindingDelta }) {
  if (delta.resolved.length === 0) return null;

  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg">
        <span className="transition-transform duration-(--duration-fast) group-open:rotate-90">
          ›
        </span>
        Show what was resolved
      </summary>
      <ul className="mt-2.5 space-y-1.5 border-l border-border pl-3">
        {delta.resolved.map((finding) => (
          <li
            key={finding.fingerprint}
            className="flex flex-wrap items-baseline gap-x-1.5 text-xs"
          >
            <span
              className={cn("font-medium", SEVERITY_META[finding.severity].text)}
            >
              {SEVERITY_META[finding.severity].label}
            </span>
            <span aria-hidden>·</span>
            <span className="text-fg-muted">{finding.title}</span>
            {finding.file && (
              <span className="font-mono text-fg-subtle">{finding.file}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
