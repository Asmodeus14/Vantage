import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Github } from "lucide-react";

import { FileSource } from "@/components/report/file-source";
import { FileTree } from "@/components/report/file-tree";
import { ApiError, api, describeError } from "@/lib/api";
import { authHeaders } from "@/lib/session";
import { repoShortName } from "@/lib/utils";
import type { SourceFile, SourceTree } from "@/lib/types";

export const dynamic = "force-dynamic";

function joinPath(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; path: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  return { title: joinPath(path) };
}

export default async function FilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; path: string[] }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { id, path: segments } = await params;
  const { line } = await searchParams;
  const path = joinPath(segments);
  const headers = await authHeaders();

  const report = await api.getReport(id, { headers }).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!report) notFound();

  /*
    Tree and file in parallel. They are independent reads and, for a
    repository, each is a separate GitHub round-trip — waterfalling them would
    double the wait for no benefit.

    Settled rather than `all`: a tree that fails should not blank the file
    someone actually asked for, and vice versa.
  */
  const [treeResult, fileResult] = await Promise.allSettled([
    api.listFiles(id, { headers }),
    api.readFile(id, path, { headers }),
  ]);

  const tree: SourceTree | null =
    treeResult.status === "fulfilled" ? treeResult.value : null;
  const file: SourceFile | null =
    fileResult.status === "fulfilled" ? fileResult.value : null;

  const title =
    repoShortName(report.source.repository) ?? report.source.filename ?? "Report";
  const focusLine = line ? Number.parseInt(line, 10) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/r/${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1.5 rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {title}
        </Link>
        <span aria-hidden className="text-fg-subtle">
          /
        </span>
        <h1 className="min-w-0 truncate font-mono text-sm text-fg">{path}</h1>

        {report.source.url && report.source.commit && (
          <a
            href={`${report.source.url}/blob/${report.source.commit}/${path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded text-xs text-fg-subtle transition-colors duration-(--duration-fast) hover:text-fg"
          >
            <Github className="size-3.5" aria-hidden />
            View on GitHub
          </a>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="max-h-[calc(100vh-10rem)] lg:sticky lg:top-4">
          {tree ? (
            <FileTree
              files={tree.files}
              reportId={id}
              activePath={path}
              truncated={tree.truncated}
            />
          ) : (
            <Unavailable
              reason={
                treeResult.status === "rejected"
                  ? describeError(treeResult.reason)
                  : undefined
              }
              what="file list"
            />
          )}
        </aside>

        <main className="min-w-0">
          {file ? (
            <FileSource file={file} focusLine={focusLine} />
          ) : (
            <Unavailable
              reason={
                fileResult.status === "rejected"
                  ? describeError(fileResult.reason)
                  : undefined
              }
              what="file"
            />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Source can be gone for several different reasons, and each has a different
 * remedy — the repository went private, the commit was force-pushed away, the
 * upload predates blob storage. The API says which; this shows it verbatim
 * rather than replacing it with "unavailable".
 */
function Unavailable({
  reason,
  what,
}: {
  reason?: { message: string; detail?: string };
  what: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-sunken p-4">
      <p className="text-sm text-fg">
        {reason?.message ?? `This ${what} could not be loaded.`}
      </p>
      {reason?.detail && (
        <p className="mt-1 text-pretty text-xs text-fg-muted">{reason.detail}</p>
      )}
    </div>
  );
}
