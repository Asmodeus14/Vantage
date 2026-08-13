import Link from "next/link";
import { FileArchive, Github } from "lucide-react";

import { LinkPending } from "@/components/link-pending";
import { SeverityBadge } from "@/components/ui/badge";
import { displayScore, scoreColour } from "@/lib/severity";
import { cn, formatRelativeTime, pluralise } from "@/lib/utils";
import type { ReportSummary, Severity } from "@/lib/types";

/**
 * One row in the recent-analyses and history lists.
 *
 * `compact` is for rows already sitting under a heading that names the
 * repository — repeating it on every row turns a list of runs into a column of
 * identical text, so the run's own timestamp leads instead.
 */
export function ReportListItem({
  report,
  compact = false,
}: {
  report: ReportSummary;
  compact?: boolean;
}) {
  const title =
    report.source.repository ?? report.source.filename ?? "Uploaded archive";
  const Icon = report.source.kind === "repository" ? Github : FileArchive;

  const present = (["critical", "high", "medium", "low"] as const).filter(
    (severity) => report.severity_counts[severity] > 0,
  );

  return (
    <Link
      href={`/r/${report.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface-hover"
    >
      {!compact && <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden />}

      <div className="min-w-0 flex-1">
        {compact ? (
          <>
            <div className="truncate text-sm text-fg">
              <time dateTime={report.created_at}>
                {formatRelativeTime(report.created_at)}
              </time>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
              {report.source.ref && (
                <>
                  <span className="font-mono">{report.source.ref}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>
                {report.total_findings} {pluralise(report.total_findings, "finding")}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="truncate text-sm font-medium text-fg">{title}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
              {report.source.ref && (
                <>
                  <span className="font-mono">{report.source.ref}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <time dateTime={report.created_at}>
                {formatRelativeTime(report.created_at)}
              </time>
              <span aria-hidden>·</span>
              <span>
                {report.total_findings} {pluralise(report.total_findings, "finding")}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="hidden items-center gap-1 sm:flex">
        {present.slice(0, 3).map((severity) => (
          <SeverityCount
            key={severity}
            severity={severity}
            count={report.severity_counts[severity]}
          />
        ))}
      </div>

      <div className="flex w-14 shrink-0 items-center justify-end gap-1">
        {/* Replaces the score while the next page is being fetched, so the
            click is acknowledged at the point it happened. */}
        <LinkPending />
        <span
          className={cn(
            "tabular text-base font-semibold",
            scoreColour(displayScore(report)),
          )}
        >
          {displayScore(report)}
        </span>
        <span className="text-xs text-fg-subtle">{report.grade}</span>
      </div>
    </Link>
  );
}

function SeverityCount({ severity, count }: { severity: Severity; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <SeverityBadge severity={severity} showLabel={false} />
      <span className="tabular text-xs text-fg-muted">{count}</span>
    </span>
  );
}
