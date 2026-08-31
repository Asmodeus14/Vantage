import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportView } from "@/components/report/report-view";
import { ApiError, api } from "@/lib/api";
import { authHeaders } from "@/lib/session";
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
      /*
        The summary goes to `og:description`, not `description`.

        The layout renders a `<meta name="description">` into the first-flush
        head for every route; setting one here too would put two on the page,
        and only a crawler — which gets blocking metadata — would ever see the
        second. `og:description` is what link previews read, and the crawlers
        that fetch those are exactly the ones that do get the full head, so the
        report's own summary still reaches the place it is actually used.

        Nothing is lost for search: this route is `no-store` and its id is
        unguessable, so it was never going to be indexed on its own terms.
      */
      openGraph: { description: report.score.summary },
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
    The trend history is deliberately not fetched here.

    It cannot run in parallel with the report — it needs the repository name
    the report carries — so on the server it could only ever be a second,
    serial round-trip. Handing it down as an unawaited promise kept it off the
    first paint but not off the response: a streamed document does not finish
    until every Suspense boundary in it resolves, and timing the chunks off the
    wire showed that boundary holding the connection open for a further 1.6s
    after the report was already on screen.

    `TrendPanelClient` fetches it from the browser instead. The document now
    ends with the report, and the chart arrives after hydration.
  */
  return <ReportView report={report} />;
}
