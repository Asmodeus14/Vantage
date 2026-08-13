"use client";

import { Suspense, use } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";

import { DeltaSummary } from "@/components/report/delta-summary";
import { TrendPanel } from "@/components/report/trend-panel";
import { Tooltip } from "@/components/ui/tooltip";
import { CATEGORY_LABELS, SEVERITY_META, scoreColour } from "@/lib/severity";
import { cn, pluralise } from "@/lib/utils";
import { SEVERITIES } from "@/lib/types";
import type { Report, ReportSummary } from "@/lib/types";

/**
 * The overview answers "what is this codebase, and how bad is it?" — and,
 * crucially, *why* the score is what it is.
 *
 * Laid out as a document rather than a dashboard. An earlier version stacked
 * four bordered panels down the page, which read as a template: each one drew a
 * box around a paragraph or a five-item list, and the boxes competed with the
 * content for attention. Sections separated by a hairline and set by their
 * headings carry the same structure with none of the furniture.
 */
export function OverviewPanel({
  report,
  history,
  onViewFindings,
  onViewNewFindings,
}: {
  report: Report;
  /** Previous analyses of the same repository, newest first. */
  history: Promise<ReportSummary[]>;
  onViewFindings: () => void;
  /** Jump to Findings showing only what appeared since the last analysis. */
  onViewNewFindings: () => void;
}) {
  const { project, score, severity_counts: counts } = report;
  const withFindings = score.categories
    .filter((category) => category.findings > 0)
    .sort((a, b) => a.score - b.score);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
      <div className="min-w-0 space-y-7">
        {/* The score's own explanation, set as the lead. */}
        <p className="max-w-[70ch] text-pretty text-[15px] leading-relaxed text-fg">
          {score.summary}
        </p>

        {/*
          Directly under the score, because "did it get better?" is the reading
          most people apply to the number above whether or not the data is
          there to support it.
        */}
        <DeltaSummary report={report} onViewNew={onViewNewFindings} />

        <Section
          title="Findings"
          action={
            report.findings.length > 0 && (
              <button
                type="button"
                onClick={onViewFindings}
                className="inline-flex items-center gap-1 rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
              >
                View all
                <ArrowRight className="size-3" aria-hidden />
              </button>
            )
          }
        >
          <ul className="flex flex-wrap gap-x-10 gap-y-4">
            {SEVERITIES.map((severity) => {
              const meta = SEVERITY_META[severity];
              const count = counts[severity];
              const empty = count === 0;

              return (
                <li key={severity} className="min-w-[3.25rem]">
                  <div
                    className={cn(
                      "tabular text-2xl font-semibold leading-none tracking-tight",
                      // Zero is worth showing — "no critical issues" is the
                      // answer people came for — but it should recede.
                      empty ? "text-fg-subtle" : "text-fg",
                    )}
                  >
                    {count}
                  </div>
                  <div
                    className={cn(
                      "mt-1.5 text-xs",
                      empty ? "text-fg-subtle" : meta.text,
                    )}
                  >
                    {meta.label}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {withFindings.length > 0 && (
          <Section
            title="Score by category"
            action={
              <span className="text-xs text-fg-subtle">
                weighted across {score.categories.length} categories
              </span>
            }
          >
            <ul className="max-w-xl space-y-3">
              {withFindings.map((category) => (
                <li key={category.category}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-fg">
                      {CATEGORY_LABELS[category.category]}
                    </span>
                    <span className="text-fg-subtle">
                      <span
                        className={cn(
                          "tabular font-medium",
                          scoreColour(category.score),
                        )}
                      >
                        {category.score}
                      </span>
                      <span className="mx-1">·</span>
                      {category.findings} {pluralise(category.findings, "finding")}
                    </span>
                  </div>
                  <Tooltip
                    content={`Weight ${category.weight}× in the overall score`}
                    side="top"
                  >
                    {/*
                      A neutral fill. Colouring the bar by score threshold put
                      two near-identical ochre bars next to each other and made
                      a measurement look like an alarm — the length already
                      encodes the value, and the number beside it carries the
                      judgement.
                    */}
                    <div className="h-1 overflow-hidden rounded-sm bg-surface-hover">
                      <div
                        className="h-full rounded-sm bg-fg-subtle transition-[width] duration-(--duration-slow)"
                        style={{ width: `${category.score}%` }}
                      />
                    </div>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Only for repositories: an uploaded archive has no stable identity to
            trend against, so there is nothing honest to show. */}
        {report.source.repository && (
          <Suspense fallback={<TrendSkeleton />}>
            <TrendPanelAsync
              history={history}
              currentId={report.id}
              repository={report.source.repository}
            />
          </Suspense>
        )}
      </div>

      <aside className="min-w-0 space-y-6 lg:border-l lg:border-border lg:pl-10">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Files" value={project.analysed_files.toLocaleString()} />
          <Stat label="Lines" value={project.total_lines.toLocaleString()} />
        </div>

        {/* Sub-1% languages rendered as an invisible sliver next to a "0%"
            label, which is noise rather than data. */}
        {project.languages.filter((l) => l.share >= 0.01).length > 0 && (
          <Section title="Languages" compact>
            <ul className="space-y-1.5">
              {project.languages
                .filter((language) => language.share >= 0.01)
                .slice(0, 5)
                .map((language) => (
                  <li key={language.language} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-xs text-fg">
                      {language.language}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-sm bg-surface-hover">
                      <div
                        className="h-full rounded-sm bg-fg-subtle"
                        style={{ width: `${Math.max(2, language.share * 100)}%` }}
                      />
                    </div>
                    <span className="tabular w-8 shrink-0 text-right text-xs text-fg-subtle">
                      {Math.round(language.share * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
          </Section>
        )}

        {project.frameworks.length > 0 && (
          <Section title="Stack" compact>
            <p className="font-mono text-xs leading-relaxed text-fg-muted">
              {[...project.frameworks, ...project.package_managers].join(" · ")}
            </p>
          </Section>
        )}

        <Section title="Practices" compact>
          <ul className="space-y-1">
            <Practice ok={project.has_tests} label="Automated tests" />
            <Practice ok={project.has_ci} label="CI pipeline" />
            <Practice ok={project.has_lockfile} label="Dependency lockfile" />
          </ul>
        </Section>

        {project.entry_points.length > 0 && (
          <Section title="Entry points" compact>
            <ul className="space-y-0.5">
              {project.entry_points.slice(0, 4).map((entry) => (
                <li key={entry} className="truncate font-mono text-xs text-fg-muted">
                  {entry}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.ingest.rejected_entries &&
          Object.keys(report.ingest.rejected_entries).length > 0 && (
            <Section title="Archive entries refused" compact>
              <ul className="space-y-1 text-xs">
                {Object.entries(report.ingest.rejected_entries).map(
                  ([reason, count]) => (
                    <li key={reason} className="flex justify-between gap-2">
                      <span className="font-mono text-fg-muted">{reason}</span>
                      <span className="tabular text-fg">{count}</span>
                    </li>
                  ),
                )}
              </ul>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-fg-subtle">
                <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                <span>
                  Not extracted: they tried to escape the extraction directory,
                  or were not regular files.
                </span>
              </p>
            </Section>
          )}
      </aside>
    </div>
  );
}

/**
 * A titled block.
 *
 * The rule sits above the heading rather than boxing the content, so sections
 * read as a continuous document instead of a stack of cards.
 */
function Section({
  title,
  action,
  compact = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** For the sidebar, where sections are short and the rule would dominate. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={compact ? undefined : "border-t border-border pt-5"}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          className={cn(
            compact
              ? "text-xs font-medium text-fg-muted"
              : "text-[13px] font-semibold tracking-tight text-fg",
          )}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Practice({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-baseline gap-2 text-xs">
      {/*
        A dash and a tick rather than a green circle and a grey cross. Colour
        here was decorative — the label already says what it is, and reserving
        green for "good" across three always-present rows made a checklist look
        like a status board.
      */}
      <span
        aria-hidden
        className={cn("w-2 shrink-0 font-mono", ok ? "text-fg" : "text-fg-subtle")}
      >
        {ok ? "✓" : "–"}
      </span>
      <span className={ok ? "text-fg" : "text-fg-subtle"}>{label}</span>
      <span className="sr-only">{ok ? "present" : "absent"}</span>
    </li>
  );
}

/**
 * Unwraps the history promise so `TrendPanel` keeps taking a plain array.
 *
 * The async concern lives here rather than in the panel: the panel is pure and
 * eight tests render it with a literal list, and threading a promise through
 * its signature would have made every one of them construct one for nothing.
 */
function TrendPanelAsync({
  history,
  currentId,
  repository,
}: {
  history: Promise<ReportSummary[]>;
  currentId: string;
  repository: string;
}) {
  return (
    <TrendPanel
      history={use(history)}
      currentId={currentId}
      repository={repository}
    />
  );
}


/**
 * Reserves the chart's real height so nothing shifts when it arrives. CLS is 0
 * on this page and streaming must not be what breaks it.
 */
function TrendSkeleton() {
  return (
    <section aria-hidden>
      <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-raised" />
      <div className="h-[200px] animate-pulse rounded-md bg-surface-raised" />
    </section>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="tabular truncate text-xl font-semibold tracking-tight text-fg">
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-fg-muted">{label}</div>
    </div>
  );
}
