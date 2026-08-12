import Link from "next/link";
import { Github } from "lucide-react";

import { Sparkline } from "@/components/charts/sparkline";
import { ReportListItem } from "@/components/report-list-item";

import { scoreColour } from "@/lib/severity";
import { cn, pluralise } from "@/lib/utils";
import type { ReportSummary } from "@/lib/types";

/**
 * Every stored analysis of one repository.
 *
 * The header carries the shape of the project over time — latest score, the
 * movement since the first run, and a sparkline — so the list below is a
 * detail view rather than the only way to read the history.
 */
export function RepositoryGroup({
  repository,
  reports,
}: {
  /** Newest first. */
  reports: ReportSummary[];
  repository: string;
}) {
  // Oldest first for the sparkline; time reads left to right.
  const scores = [...reports].reverse().map((report) => report.score);
  const latest = reports[0];
  const oldest = reports[reports.length - 1];
  if (!latest || !oldest) return null;

  const delta = latest.score - oldest.score;

  return (
    // A section, not a card. Every other surface in the app dropped its
    // border; a page of bordered boxes was the last place that still read as
    // a template.
    <section>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Github className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <Link
            href={`/history?repository=${encodeURIComponent(repository)}`}
            className="truncate rounded text-[13px] font-semibold tracking-tight text-fg hover:underline"
          >
            {repository}
          </Link>
          <span className="shrink-0 text-xs text-fg-subtle">
            {reports.length} {pluralise(reports.length, "run")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Returns null below two points — one run is not a trend. */}
          <Sparkline
            values={scores}
            label={
              delta === 0
                ? `Score unchanged at ${latest.score} across ${reports.length} runs`
                : `Score ${delta > 0 ? "rose" : "fell"} from ${oldest.score} to ${latest.score}`
            }
            // Neutral when nothing moved. Green on a flat line reads as
            // "improving", which is the one thing it is not.
            colour={
              delta === 0
                ? "var(--fg-subtle)"
                : delta < 0
                  ? "var(--critical)"
                  : "var(--success)"
            }
          />
          <div className="flex w-14 items-baseline justify-end gap-1">
            <span
              className={cn("tabular text-base font-semibold", scoreColour(latest.score))}
            >
              {latest.score}
            </span>
            <span className="text-xs text-fg-subtle">{latest.grade}</span>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {reports.map((report) => (
          <li key={report.id}>
            <ReportListItem report={report} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
