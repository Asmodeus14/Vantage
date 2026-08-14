"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Boxes,
  Download,
  ExternalLink,
  FileArchive,
  GitCommitHorizontal,
  Github,
  ListFilter,
  LayoutDashboard,
} from "lucide-react";

import { OverviewPanel } from "@/components/report/overview-panel";
import { PanelSkeleton } from "@/components/report/panel-skeleton";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";
import { scoreColour } from "@/lib/severity";
import type { Report } from "@/lib/types";

/**
 * Overview opens by default, so it is imported normally. The other three are
 * code behind a tab nobody has clicked yet.
 *
 * Radix already declines to mount inactive tab content, which is why a trace of
 * this page found a 153 kB chunk that was 99.8% unused — downloaded and parsed,
 * then never run. Worse, it was not requested until 6.7s in, because it is
 * referenced from a late chunk of the streamed HTML, so it was competing for
 * bandwidth with the content the reader is actually waiting for.
 *
 * `ssr: false` is deliberate. These panels only appear after a click or a
 * `?tab=` deep link, and server-rendering them would put the markup back into
 * the payload that splitting them out was meant to shrink.
 */
const FindingsPanel = dynamic(
  () => import("@/components/report/findings-panel").then((m) => m.FindingsPanel),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
);

const DependenciesPanel = dynamic(
  () =>
    import("@/components/report/dependencies-panel").then(
      (m) => m.DependenciesPanel,
    ),
  { ssr: false, loading: () => <PanelSkeleton rows={6} /> },
);

const ActivityPanel = dynamic(
  () => import("@/components/report/activity-panel").then((m) => m.ActivityPanel),
  { ssr: false, loading: () => <PanelSkeleton rows={6} /> },
);

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "findings", label: "Findings", icon: ListFilter },
  { id: "dependencies", label: "Dependencies", icon: Boxes },
  { id: "activity", label: "Activity", icon: GitCommitHorizontal },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_IDS: readonly string[] = TABS.map((tab) => tab.id);

export function ReportView({ report }: { report: Report }) {
  const searchParams = useSearchParams();

  // Activity only exists for repositories whose history could be read, so the
  // tab is absent rather than present-and-empty.
  const tabs = React.useMemo(
    () => TABS.filter((item) => item.id !== "activity" || report.activity),
    [report.activity],
  );

  const requested = searchParams.get("tab");
  const tab: TabId =
    requested && TAB_IDS.includes(requested) && tabs.some((t) => t.id === requested)
      ? (requested as TabId)
      : "overview";

  /**
   * The tab and the findings filter live in the URL so a link to a specific
   * view is shareable and survives a refresh — both were local state, and both
   * were lost.
   *
   * `history.replaceState` rather than `router.replace`: this route is
   * `force-dynamic`, so a router navigation would round-trip to the server to
   * re-render output that has not changed. Next 15 keeps `useSearchParams` in
   * sync with the native history API.
   *
   * Read from `window.location` rather than the `searchParams` snapshot: the
   * two writers below would otherwise each overwrite the other's param from a
   * stale closure.
   */
  const writeParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `${window.location.pathname}?${query}` : window.location.pathname,
      );
    },
    [],
  );

  const select = React.useCallback(
    (next: TabId) => {
      writeParams((params) => {
        if (next === "overview") params.delete("tab");
        else params.set("tab", next);
      });
    },
    [writeParams],
  );

  /**
   * The findings filter, mirrored from the panel so it can reach the URL. The
   * param is `q`, not `file`: the filter matches title, description and rule id
   * as well as path, and the Activity hand-off is only its most common source.
   */
  const [filter, setFilter] = React.useState(() => searchParams.get("q") ?? "");

  /**
   * Debounced, because this fires on every keystroke and `replaceState` is
   * rate-limited — Safari throws after roughly 100 calls in 30 seconds. Tab
   * selection stays immediate; only the filter waits.
   */
  React.useEffect(() => {
    if (filter === (new URLSearchParams(window.location.search).get("q") ?? "")) {
      return;
    }
    const timer = window.setTimeout(() => {
      writeParams((params) => {
        if (filter) params.set("q", filter);
        else params.delete("q");
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [filter, writeParams]);

  /** "Show only what appeared since the last analysis", also shareable. */
  const [onlyNew, setOnlyNew] = React.useState(
    () => searchParams.get("new") === "1",
  );

  const selectOnlyNew = React.useCallback(
    (next: boolean) => {
      setOnlyNew(next);
      // Not debounced — this one changes on a click, not a keystroke.
      writeParams((params) => {
        if (next) params.set("new", "1");
        else params.delete("new");
      });
    },
    [writeParams],
  );

  /** What the analysis produced, unless the owner has accepted some of it. */
  const effective = report.effective_score ?? report.score;

  const counts: Partial<Record<TabId, number>> = {
    findings: report.findings.length,
    dependencies: report.dependencies.length,
    activity: report.activity?.churn.length ?? 0,
  };

  const title =
    report.source.repository ?? report.source.filename ?? "Uploaded archive";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {report.source.kind === "repository" ? (
                <Github className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              ) : (
                <FileArchive className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              )}
              <h1 className="truncate text-lg font-semibold tracking-tight text-fg">
                {title}
              </h1>
              {report.source.url && (
                <a
                  href={report.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-0.5 text-fg-subtle transition-colors duration-(--duration-fast) hover:text-fg"
                  aria-label={`Open ${title} on GitHub (new tab)`}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-subtle">
              {report.source.ref && (
                <span className="font-mono">{report.source.ref}</span>
              )}
              {report.source.commit && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <GitCommitHorizontal className="size-3" aria-hidden />
                  {report.source.commit.slice(0, 7)}
                </span>
              )}
              <time dateTime={report.created_at}>
                {formatRelativeTime(report.created_at)}
              </time>
              <span aria-hidden>·</span>
              <span>analysed in {formatDuration(report.duration_seconds)}</span>
              <span aria-hidden>·</span>
              <span>
                {report.project.analysed_files} files,{" "}
                {report.project.total_lines.toLocaleString()} lines
              </span>
              <span aria-hidden>·</span>
              {/*
                A plain link, not a button: it is a file download, and the
                browser already knows how to do those. Sitting in the metadata
                row rather than as an action beside the score keeps it where
                someone looks when they have decided to take the findings
                somewhere else, without implying it is the main thing to do.
              */}
              <a
                href={`/api/reports/${encodeURIComponent(report.id)}/sarif`}
                download={`${report.id}.vantage.sarif`}
                className="inline-flex items-center gap-1 rounded underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) hover:text-fg hover:decoration-fg"
                title="SARIF 2.1.0 — import into GitHub code scanning, VS Code or any SARIF viewer"
              >
                <Download className="size-3" aria-hidden />
                Export SARIF
              </a>
            </div>
          </div>

          {/*
            The adjusted score leads when findings have been accepted, since it
            is the one describing the code as its owner has chosen to see it —
            but the analysed score stays on screen. Replacing it outright would
            make the number unfalsifiable.
          */}
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "tabular text-3xl font-semibold tracking-tight",
                scoreColour(effective.value),
              )}
            >
              {effective.value}
            </span>
            <div className="text-xs text-fg-subtle">
              <div className="font-medium text-fg-muted">
                Grade {effective.grade}
              </div>
              {report.effective_score ? (
                <div>
                  {report.score.value} before {report.suppressed_count} accepted
                </div>
              ) : (
                <div>out of 100</div>
              )}
            </div>
          </div>
        </div>

        {report.truncated && (
          <div className="mt-3 rounded-md border border-medium-border bg-medium-bg px-3 py-2 text-xs text-fg">
            This report was capped at {report.findings.length} findings. The
            highest-severity issues are shown first.
          </div>
        )}
      </header>

      <Tabs.Root value={tab} onValueChange={(value) => select(value as TabId)}>
        {/*
          The tabs plus their counts exceed a phone's width, so the strip
          scrolls within itself rather than pushing the page body sideways.
        */}
        <div className="scrollbar-none overflow-x-auto border-b border-border">
          <Tabs.List
            aria-label="Report sections"
            className="-mb-px flex w-max gap-1"
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const count = counts[item.id];
              return (
                <Tabs.Trigger
                  key={item.id}
                  value={item.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm",
                    "text-fg-muted transition-colors duration-(--duration-fast)",
                    "hover:border-border-strong hover:text-fg",
                    "data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-fg",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {item.label}
                  {count !== undefined && count > 0 && (
                    <span className="tabular text-xs text-fg-subtle">{count}</span>
                  )}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </div>

        <div className="pt-5">
          <Tabs.Content value="overview">
            <OverviewPanel
              report={report}
              onViewFindings={() => select("findings")}
              onViewNewFindings={() => {
                selectOnlyNew(true);
                select("findings");
              }}
            />
          </Tabs.Content>
          <Tabs.Content value="findings">
            <FindingsPanel
              report={report}
              initialQuery={filter}
              onQueryChange={setFilter}
              initialOnlyNew={onlyNew}
              onOnlyNewChange={selectOnlyNew}
            />
          </Tabs.Content>
          <Tabs.Content value="dependencies">
            <DependenciesPanel report={report} />
          </Tabs.Content>
          {report.activity && (
            <Tabs.Content value="activity">
              <ActivityPanel
                report={report}
                onSelectFile={(file) => {
                  // Hand the path to the findings filter, which already
                  // matches on file as well as title and rule id.
                  setFilter(file);
                  select("findings");
                }}
              />
            </Tabs.Content>
          )}
        </div>
      </Tabs.Root>

      <footer className="mt-8 border-t border-border pt-4 text-xs text-fg-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Report <span className="font-mono">{report.id}</span> · this URL is
            shareable
          </span>
          <Link
            href="/"
            className="rounded transition-colors duration-(--duration-fast) hover:text-fg"
          >
            Analyse another repository
          </Link>
        </div>
      </footer>
    </div>
  );
}
