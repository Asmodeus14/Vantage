import { Suspense } from "react";
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

/**
 * The page's own markup contains no `await` and touches no dynamic API, so the
 * whole shell — heading, form, section frame — flushes on the first chunk and
 * the recent list streams in behind it.
 *
 * It used to await the API at the top of this component, which held the
 * response open until the answer came back: a Lighthouse trace measured 43ms to
 * first byte and 3.46s to the end of the document, with five consecutive
 * filmstrip frames of blank white. The API was never the slow part of the
 * paint; waiting for it was.
 */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Analyse a repository
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-pretty text-sm text-fg-muted">
          Security issues, secrets and dependency risk, each anchored to a file
          and line — and on a second run, what changed since the last one.
        </p>
        {/*
          One line, not a capability panel. Someone about to paste a Go
          repository should learn the depth of coverage before they wait for an
          analysis, not from a report that came back quiet. Secrets and
          dependency advisories genuinely do work anywhere, so the sentence
          says which part is narrow rather than implying all of it is.
        */}
        <p className="mt-1 text-xs text-fg-subtle">
          Rules cover JavaScript, TypeScript and Python. Secret scanning and
          dependency advisories work on any repository.
        </p>
      </div>

      <AnalyseForm />

      {/* A section, not a card. The page is otherwise container-free, so one
          bordered box around the list read as leftover furniture. */}
      <section className="mt-14" aria-labelledby="recent-heading">
        <Suspense fallback={<RecentSkeleton />}>
          <RecentAnalyses />
        </Suspense>
      </section>
    </div>
  );
}

/**
 * The heading is rendered by both the fallback and the resolved list rather
 * than sitting above the boundary, because the "View all" link depends on there
 * being something to view. Sharing one component is what keeps the two from
 * drifting apart and shifting the layout as the list arrives.
 */
function RecentHeading({ action }: { action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2
        id="recent-heading"
        className="text-[13px] font-semibold tracking-tight text-fg"
      >
        Recent analyses
      </h2>
      {action}
    </div>
  );
}

async function RecentAnalyses() {
  const reports = await recentReports();

  return (
    <>
      <RecentHeading
        action={
          reports &&
          reports.length > 0 && (
            <Link
              href="/history"
              className="rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
            >
              View all
            </Link>
          )
        }
      />

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
    </>
  );
}

/**
 * Three rows at a real row's height. The list holds up to five, but the shell
 * paints above the fold and reserving five rows of empty page below it looks
 * like a rendering fault rather than a wait.
 */
function RecentSkeleton() {
  return (
    <>
      <RecentHeading />
      <div aria-hidden className="divide-y divide-border">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-4 py-2.5">
            <div className="size-4 shrink-0 rounded animate-skeleton bg-surface-raised" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded animate-skeleton bg-surface-raised" />
              <div className="h-3 w-56 rounded animate-skeleton bg-surface-raised" />
            </div>
            <div className="h-5 w-14 shrink-0 rounded animate-skeleton bg-surface-raised" />
          </div>
        ))}
      </div>
    </>
  );
}
