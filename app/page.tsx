import Link from "next/link";

import { AnalyseForm } from "@/components/analyse-form";
import { ReportListItem } from "@/components/report-list-item";
import { api } from "@/lib/api";
import { authHeaders } from "@/lib/session";
import type { ReportSummary } from "@/lib/types";

// Recent reports change on every analysis, so never serve a cached shell.
export const dynamic = "force-dynamic";

async function recentReports(): Promise<ReportSummary[] | null> {
  try {
    return await api.listReports(5, { headers: await authHeaders() });
  } catch {
    // The backend being down must not break the page whose whole job is to
    // start an analysis. The form still works; history is simply absent.
    return null;
  }
}

export default async function HomePage() {
  const reports = await recentReports();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Analyse a repository
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-pretty text-sm text-fg-muted">
          Point it at a repository and it reports what is wrong and exactly
          where — each finding anchored to a file and line.
        </p>
      </div>

      <AnalyseForm />

      {/* A section, not a card. The page is otherwise container-free, so one
          bordered box around the list read as leftover furniture. */}
      <section className="mt-14" aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2
            id="recent-heading"
            className="text-[13px] font-semibold tracking-tight text-fg"
          >
            Recent analyses
          </h2>
          {reports && reports.length > 0 && (
            <Link
              href="/history"
              className="rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
            >
              View all
            </Link>
          )}
        </div>

        {reports === null ? (
          <p className="pt-3 text-sm text-fg-muted">
            Report history is unavailable while the analysis server is
            unreachable. You can still start an analysis above.
          </p>
        ) : reports.length === 0 ? (
          <p className="max-w-[62ch] pt-3 text-sm text-fg-muted">
            No analyses yet. Paste a repository URL above — the report gets its
            own URL, so you can share it or come back to it later.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <li key={report.id}>
                <ReportListItem report={report} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
