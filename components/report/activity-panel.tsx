"use client";

import { AlertCircle, GitCommitHorizontal } from "lucide-react";

import { BarChart } from "@/components/charts/bar-chart";
import { SeverityBadge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, pluralise } from "@/lib/utils";
import type { ChurnEntry, Report } from "@/lib/types";

/**
 * How often the code with problems in it actually changes.
 *
 * A finding in a file untouched for two years is not the same risk as the same
 * finding in a file that changes every week — the second one is code someone is
 * still working in, where a fix will hold and a bug will bite. That comparison
 * is the reason this tab exists; the commit chart is context for it.
 */
export function ActivityPanel({
  report,
  onSelectFile,
}: {
  report: Report;
  /** Jumps to the findings list filtered to that file. */
  onSelectFile: (file: string) => void;
}) {
  const activity = report.activity;

  if (!activity) {
    return (
      <Panel>
        <EmptyState
          icon={GitCommitHorizontal}
          title="No commit history for this report"
          description={
            report.source.kind === "upload"
              ? "Commit history comes from GitHub. An uploaded archive carries no repository to look up."
              : "This repository's history could not be read when the analysis ran."
          }
        />
      </Panel>
    );
  }

  const hasCommits = activity.weekly_commits.length > 0;

  // Only files that actually moved. Listing every file with a finding puts
  // twenty rows of "0" above the four that carry the signal, which is the
  // opposite of what this panel is for — the unchanged ones are summarised
  // underneath instead.
  const changed = activity.churn.filter((entry) => entry.changes > 0);
  const busiest = Math.max(0, ...changed.map((entry) => entry.changes));
  // Reports stored before `files_with_findings` existed report it as 0; the
  // measured rows are then the best count available.
  const withFindings = Math.max(activity.files_with_findings, activity.churn.length);
  const unchanged = withFindings - changed.length;

  const hasChurn = changed.length > 0;
  const dormant = activity.churn.length > 0 && changed.length === 0;

  return (
    <div className="space-y-4">
      {activity.partial && activity.unavailable_reason && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-medium-border bg-medium-bg px-3 py-2.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-medium" aria-hidden />
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-fg">
            {activity.unavailable_reason}
          </p>
        </div>
      )}

      {hasChurn && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Findings in code that keeps changing</PanelTitle>
            <span className="text-xs text-fg-subtle">
              last {activity.window_days} days
            </span>
          </PanelHeader>
          <PanelBody className="p-0">
            <ChurnTable
              entries={changed}
              busiest={busiest}
              onSelectFile={onSelectFile}
            />
            {unchanged > 0 && (
              <p className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle">
                {unchanged} other {pluralise(unchanged, "file")} carrying
                findings {pluralise(unchanged, "has", "have")} not changed in
                this window.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}

      {dormant && (
        <Panel>
          <PanelHeader>
            <PanelTitle>File activity</PanelTitle>
            <span className="text-xs text-fg-subtle">
              last {activity.window_days} days
            </span>
          </PanelHeader>
          <PanelBody>
            <p className="max-w-[70ch] text-sm text-fg-muted">
              None of the {withFindings} {pluralise(withFindings, "file")}{" "}
              carrying findings {pluralise(withFindings, "has", "have")} changed
              in the last {activity.window_days} days. This code is
              settled — a fix here is unlikely to be overwritten, but nobody is
              working in it either.
            </p>
          </PanelBody>
        </Panel>
      )}

      {hasCommits && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Commit activity</PanelTitle>
            <span className="text-xs text-fg-subtle">
              {activity.weekly_commits.reduce((total, week) => total + week, 0)} commits
              over {activity.weekly_commits.length} weeks
            </span>
          </PanelHeader>
          <PanelBody>
            <BarChart
              values={activity.weekly_commits}
              labels={weekLabels(activity.weekly_commits.length)}
              height={130}
              caption={commitCaption(activity.weekly_commits)}
              renderTooltip={(index) => (
                <div className="space-y-0.5">
                  <div className="text-fg-subtle">
                    {weeksAgo(activity.weekly_commits.length - 1 - index)}
                  </div>
                  <div className="tabular font-medium text-fg">
                    {activity.weekly_commits[index] ?? 0}{" "}
                    {pluralise(activity.weekly_commits[index] ?? 0, "commit")}
                  </div>
                </div>
              )}
            />
          </PanelBody>
        </Panel>
      )}

      {!hasChurn && !dormant && !hasCommits && (
        <Panel>
          <EmptyState
            icon={GitCommitHorizontal}
            title="Nothing to show yet"
            description={
              activity.unavailable_reason ??
              "No commits in the window, and no findings anchored to a file."
            }
          />
        </Panel>
      )}
    </div>
  );
}

function ChurnTable({
  entries,
  busiest,
  onSelectFile,
}: {
  entries: ChurnEntry[];
  /** Highest change count, for scaling the bars. Always > 0 here. */
  busiest: number;
  onSelectFile: (file: string) => void;
}) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="border-b border-border text-xs text-fg-muted">
          <th scope="col" className="px-4 py-2 font-medium">
            File
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Findings
          </th>
          <th scope="col" className="w-[38%] px-4 py-2 font-medium">
            Commits
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {entries.map((entry) => (
          <tr key={entry.file} className="group/row hover:bg-surface-hover">
            <td className="max-w-0 px-4 py-2">
              <button
                type="button"
                onClick={() => onSelectFile(entry.file)}
                className="block w-full truncate text-left font-mono text-xs text-fg hover:text-accent hover:underline"
                title={`Show the ${entry.findings} ${pluralise(entry.findings, "finding")} in ${entry.file}`}
              >
                {entry.file}
              </button>
            </td>

            <td className="whitespace-nowrap px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <Tooltip
                  content={`Most severe: ${entry.top_severity}`}
                  side="top"
                >
                  <span>
                    <SeverityBadge severity={entry.top_severity} showLabel={false} />
                  </span>
                </Tooltip>
                <span className="tabular text-xs text-fg-muted">{entry.findings}</span>
              </span>
            </td>

            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      // Frequently-changed code with findings in it is the
                      // thing to look at, so the bar carries that weight.
                      entry.changes === 0 ? "bg-fg-subtle" : "bg-series-1",
                    )}
                    style={{
                      width: `${Math.max(entry.changes === 0 ? 0 : 3, (entry.changes / busiest) * 100)}%`,
                    }}
                  />
                </div>
                <span className="tabular w-8 shrink-0 text-right text-xs text-fg-subtle">
                  {entry.changes}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sparse labels: a tick every ~13 weeks reads as quarters. */
function weekLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const back = count - 1 - index;
    if (back === 0) return "now";
    return `${back}w`;
  });
}

function weeksAgo(back: number): string {
  if (back === 0) return "This week";
  return `${back} ${pluralise(back, "week")} ago`;
}

function commitCaption(weeks: number[]): string {
  const total = weeks.reduce((sum, week) => sum + week, 0);
  const recent = weeks.slice(-4).reduce((sum, week) => sum + week, 0);
  if (total === 0) return "No commits in the last year.";
  if (recent === 0) {
    return `${total} commits over the last year, but none in the last four weeks.`;
  }
  return `${total} commits over the last year, ${recent} of them in the last four weeks.`;
}
