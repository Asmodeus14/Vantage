import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Github, Search } from "lucide-react";

import { ScoreTrend } from "@/components/dash/score-trend";
import { Sparkline } from "@/components/charts/sparkline";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api, describeError } from "@/lib/api";
import { dashboardStats, groupReports, scoreTrend, trendLabels } from "@/lib/reports";
import { displayScore, gradeColour, scoreColour } from "@/lib/severity";
import { authHeaders } from "@/lib/session";
import type { ReportSummary } from "@/lib/types";
import { formatRelativeTime, pluralise, repoShortName } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Everything analysed so far, in one view.
 *
 * The report page answers "how is this repository?"; nothing answered "how are
 * my repositories?" until this existed. It reads the same `listReports` the
 * history page does — there is no new endpoint behind it, only derivations in
 * `lib/reports.ts`.
 */
export default async function DashboardPage() {
  let reports: ReportSummary[] | null = null;
  let failure: { message: string; detail?: string } | null = null;

  try {
    reports = await api.listReports(50, { headers: await authHeaders() });
  } catch (error) {
    failure = describeError(error);
  }

  if (failure) {
    return (
      <div className="py-6">
        <Header />
        <ErrorState
          title="Couldn't load your dashboard"
          description={failure.message}
          {...(failure.detail && { detail: failure.detail })}
        />
      </div>
    );
  }

  const all = reports ?? [];

  // Four zeros and an empty chart is not a dashboard, it is a bug report.
  if (all.length === 0) {
    return (
      <div className="py-6">
        <Header />
        <Panel className="mt-4">
          <EmptyState
            icon={Search}
            title="Nothing analysed yet"
            description="Run your first analysis and this fills in — scores over time, which projects carry the most risk, and what changed between runs."
            action={
              <Button asChild variant="primary">
                <Link href="/analyse">Analyse a repository</Link>
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const stats = dashboardStats(all);
  const { repositories } = groupReports(all);
  const latest = all[0];
  const trend = scoreTrend(all, 12);

  return (
    <div className="space-y-4 py-2">
      <Header />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main column. */}
        <div className="space-y-4">
          {latest && <LatestCard report={latest} />}

          <Panel>
            <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-fg">
                Repositories
              </h2>
              <Link
                href="/history"
                className="rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
              >
                View all
              </Link>
            </div>

            {repositories.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-muted">
                Only uploaded archives so far. Analyse a repository URL and each
                project gets its own row here, with its score history.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {repositories.slice(0, 6).map(([name, runs]) => (
                  <li key={name}>
                    <RepositoryRow name={name} runs={runs} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Sidebar. */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat value={stats.repositories} label="Repositories" hint="analysed" />
            <Stat
              value={stats.openHighRisk}
              label="Critical + high"
              hint="in latest runs"
              className={stats.openHighRisk > 0 ? "text-critical" : undefined}
            />
          </div>

          <Panel>
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-fg">
                Your statistics
              </h2>
              <p className="mt-0.5 text-xs text-fg-subtle">
                Score across the last {trend.length}{" "}
                {pluralise(trend.length, "analysis", "analyses")}
                {stats.medianScore !== null && ` · median ${stats.medianScore}`}
              </p>
            </div>
            <div className="p-4">
              {/* Labels formatted here, on the server, so hydration cannot
                  disagree about the locale. See `trendLabels`. */}
              <ScoreTrend reports={trend} labels={trendLabels(trend)} />
            </div>
          </Panel>

          <Panel className="p-4">
            <h2 className="font-display text-sm font-bold tracking-tight text-fg">
              Run it again
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
              A second analysis of the same repository is where the delta comes
              from — new, resolved and reopened since last time.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-3">
              <Link href="/analyse">
                Analyse
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
          Dashboard
        </h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          Every repository you have analysed, and how they are trending.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link href="/analyse">
          <Search className="size-3.5" aria-hidden />
          Analyse a repository
        </Link>
      </Button>
    </div>
  );
}

/** The greeting card's job: get you back to the run you were just looking at. */
function LatestCard({ report }: { report: ReportSummary }) {
  const score = displayScore(report);
  // `||`, not `??`: repoShortName returns "" for a missing repository rather
  // than null, so nullish coalescing never falls through to the filename.
  const name =
    repoShortName(report.source.repository) || report.source.filename || "Analysis";

  return (
    <Panel className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Most recent
        </p>
        <p className="mt-1 truncate font-display text-xl font-bold tracking-tight text-fg">
          {name}
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">
          {formatRelativeTime(report.created_at)} · {report.total_findings}{" "}
          {pluralise(report.total_findings, "finding")}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className={`tabular text-3xl font-bold ${scoreColour(score)}`}>
            {score}
          </div>
          <div className={`text-xs font-medium ${gradeColour(report.grade)}`}>
            Grade {report.grade}
          </div>
        </div>
        <Button asChild variant="primary" size="sm">
          <Link href={`/r/${report.id}`}>
            Open
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function RepositoryRow({ name, runs }: { name: string; runs: ReportSummary[] }) {
  const latest = runs[0];
  const oldest = runs[runs.length - 1];
  if (!latest || !oldest) return null;

  // Oldest first for the sparkline; time reads left to right.
  const scores = [...runs].reverse().map(displayScore);
  const score = displayScore(latest);
  const delta = score - displayScore(oldest);

  return (
    <Link
      href={`/r/${latest.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface-hover"
    >
      <Github className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg">{name}</div>
        <div className="text-xs text-fg-subtle">
          {runs.length} {pluralise(runs.length, "run")} ·{" "}
          {formatRelativeTime(latest.created_at)}
        </div>
      </div>

      {/* Returns null below two points — one run is not a trend. */}
      <Sparkline
        values={scores}
        colour="var(--series-1)"
        label={
          delta === 0
            ? `Score unchanged at ${score}`
            : `Score ${delta > 0 ? "rose" : "fell"} from ${displayScore(oldest)} to ${score}`
        }
      />

      <div className="w-10 shrink-0 text-right">
        <span className={`tabular text-sm font-semibold ${scoreColour(score)}`}>
          {score}
        </span>
      </div>
    </Link>
  );
}

function Stat({
  value,
  label,
  hint,
  className,
}: {
  value: number;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <Panel className="p-3">
      <div className={`tabular text-2xl font-bold tracking-tight text-fg ${className ?? ""}`}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg-subtle">{hint}</div>
    </Panel>
  );
}
