import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportView } from "@/components/report/report-view";
import { ApiError, api } from "@/lib/api";
import { authHeaders } from "@/lib/session";
import type { ReportSummary } from "@/lib/types";
import { repoShortName } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Deduplicated for the render pass.
 *
 * `generateMetadata` and the page body both need the report, and without this
 * each one issued its own request — two full round-trips to the API before any
 * HTML was sent, on a host that sleeps when idle. `cache()` collapses them into
 * one for the lifetime of the request.
 */
const load = cache(async (id: string) => {
  try {
    return await api.getReport(id, { headers: await authHeaders() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

/**
 * Previous analyses of the same repository, for the trend panel.
 *
 * Fetched on the server alongside the report so the chart is in the first
 * paint rather than arriving after a client waterfall. A failure here must not
 * take down the report — the trend is an addition, not the point of the page.
 */
async function loadHistory(repository: string | null): Promise<ReportSummary[]> {
  if (!repository) return [];
  try {
    return await api.listReports(20, { repository, headers: await authHeaders() });
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const report = await load(id);
    if (!report) return { title: "Report not found" };
    const name =
      repoShortName(report.source.repository) ??
      report.source.filename ??
      "Report";
    return {
      title: `${name} — ${report.score.value}/100`,
      description: report.score.summary,
    };
  } catch {
    return { title: "Report" };
  }
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await load(id);
  if (!report) notFound();

  /*
    Deliberately not awaited.

    The trend chart needs the report to have loaded before it can ask for that
    repository's history, so the two cannot run in parallel — but the chart is
    an addition rather than the point of the page. Awaiting it here held the
    entire report behind a second round-trip to a host that sleeps when idle.

    The promise is handed to a Suspense boundary around the chart alone, so the
    report paints on the first response and the chart arrives behind it.
  */
  const history = loadHistory(report.source.repository);
  return <ReportView report={report} history={history} />;
}
