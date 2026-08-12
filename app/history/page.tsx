import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";

import { RepositoryGroup } from "@/components/history-group";
import { ReportListItem } from "@/components/report-list-item";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { api, describeError } from "@/lib/api";
import { authHeaders } from "@/lib/session";
import { pluralise } from "@/lib/utils";
import type { ReportSummary } from "@/lib/types";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

/**
 * Group analyses by what they analysed.
 *
 * A flat reverse-chronological list buries the useful comparison: five runs of
 * the same repository interleaved with three of another tells you nothing about
 * either. Grouping puts each project's runs next to each other, which is what
 * makes a per-project sparkline meaningful.
 *
 * Uploads have no stable identity across runs, so they stay ungrouped.
 */
function group(reports: ReportSummary[]) {
  const repositories = new Map<string, ReportSummary[]>();
  const uploads: ReportSummary[] = [];

  for (const report of reports) {
    const key = report.source.repository;
    if (!key) {
      uploads.push(report);
      continue;
    }
    const existing = repositories.get(key);
    if (existing) existing.push(report);
    else repositories.set(key, [report]);
  }

  // Most recently analysed project first; `reports` already arrives newest-first.
  return { repositories: [...repositories.entries()], uploads };
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ repository?: string }>;
}) {
  const { repository } = await searchParams;

  let reports: ReportSummary[] | null = null;
  let failure: { message: string; detail?: string } | null = null;

  try {
    reports = await api.listReports(50, {
      repository: repository ?? null,
      headers: await authHeaders(),
    });
  } catch (error) {
    failure = describeError(error);
  }

  const grouped = reports ? group(reports) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight text-fg">History</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Every analysis this server has stored, grouped by project. Each report
          keeps its own URL.
        </p>

        {repository && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs">
            <span className="text-fg-muted">Filtered to</span>
            <span className="font-mono text-fg">{repository}</span>
            <Link
              href="/history"
              aria-label="Clear the repository filter"
              className="rounded text-fg-subtle transition-colors duration-(--duration-fast) hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </Link>
          </p>
        )}
      </header>

      {failure ? (
        <ErrorState
          title="Couldn't load history"
          description={failure.message}
          {...(failure.detail && { detail: failure.detail })}
        />
      ) : reports && reports.length > 0 && grouped ? (
        <div className="space-y-8">
          {grouped.repositories.map(([name, runs]) => (
            <RepositoryGroup key={name} repository={name} reports={runs} />
          ))}

          {grouped.uploads.length > 0 && (
            <section>
              <h2 className="border-b border-border pb-2 text-[13px] font-semibold tracking-tight text-fg">
                {grouped.uploads.length} uploaded{" "}
                {pluralise(grouped.uploads.length, "archive")}
              </h2>
              <ul className="divide-y divide-border">
                {grouped.uploads.map((report) => (
                  <li key={report.id}>
                    <ReportListItem report={report} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        // Typography, not an illustrated card. A bordered box with a clock
        // glyph gave "there is nothing here" more presence than the content
        // it stands in for.
        <div className="border-t border-border pt-5">
          <p className="text-sm font-medium text-fg">
            {repository ? "No analyses of that repository" : "No analyses yet"}
          </p>
          <p className="mt-1 max-w-[62ch] text-sm text-fg-muted">
            {repository
              ? "Nothing stored for that project yet. Analyse it and it will appear here."
              : "Run one and it will appear here. If this server is running without a database, reports are held in memory and cleared on restart."}
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href="/">Analyse a repository</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
