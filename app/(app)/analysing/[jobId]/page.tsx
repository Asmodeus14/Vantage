import type { Metadata } from "next";

import { AnalysisProgress } from "@/components/analysis-progress";

export const metadata: Metadata = { title: "Analysing" };

export default async function AnalysingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <AnalysisProgress jobId={jobId} />;
}
