"use client";

import * as React from "react";

import { SeverityBadge } from "@/components/ui/badge";
import { SEVERITY_META, compareSeverity } from "@/lib/severity";
import { cn } from "@/lib/utils";
import type { Finding, SourceFile } from "@/lib/types";

/**
 * A whole file, with its findings marked in the gutter.
 *
 * This is what turns "line 47" from a coordinate into a place. The findings
 * arrive with the content rather than being fetched separately, so the markers
 * are there on first paint instead of appearing a moment after the code.
 *
 * Deliberately not virtualised yet. Files are capped at 1MB by the API and the
 * common case is a few hundred lines; `@tanstack/react-virtual` is installed
 * for when a real file proves that wrong, and adding it before then would mean
 * carrying the complexity of a windowed scroller with nothing to show for it.
 */
export function FileSource({
  file,
  focusLine,
}: {
  file: SourceFile;
  /** Scroll here on mount — the line someone followed a finding to. */
  focusLine?: number | null;
}) {
  const lines = React.useMemo(() => file.content.split("\n"), [file.content]);

  /** Findings by line, most severe first so the gutter shows the worst. */
  const byLine = React.useMemo(() => {
    const map = new Map<number, Finding[]>();
    for (const finding of file.findings) {
      if (!finding.line) continue;
      const bucket = map.get(finding.line) ?? [];
      bucket.push(finding);
      map.set(finding.line, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => compareSeverity(a.severity, b.severity));
    }
    return map;
  }, [file.findings]);

  const focusRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!focusLine) return;
    // `block: "center"` rather than the default: landing the line at the very
    // top of the viewport hides the context that makes it readable.
    focusRef.current?.scrollIntoView({ block: "center" });
  }, [focusLine, file.path]);

  return (
    <div className="scrollbar-thin overflow-auto rounded-md border border-border bg-surface-sunken">
      <pre className="min-w-full py-2 font-mono text-xs leading-relaxed">
        <code>
          {lines.map((line, index) => {
            const number = index + 1;
            const findings = byLine.get(number);
            const worst = findings?.[0];
            const focused = focusLine === number;

            return (
              <div
                key={number}
                ref={focused ? focusRef : undefined}
                id={`L${number}`}
                className={cn(
                  "flex scroll-my-24",
                  worst && SEVERITY_META[worst.severity].rowBg,
                  focused && "ring-1 ring-inset ring-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "tabular sticky left-0 z-10 select-none border-r border-border bg-surface-sunken px-2 text-right",
                    worst ? "font-medium text-fg" : "text-fg-subtle",
                  )}
                  style={{ minWidth: "3.5rem" }}
                >
                  {number}
                </span>
                <span className="whitespace-pre px-3 text-fg-muted">
                  {line || " "}
                </span>
              </div>
            );
          })}
        </code>
      </pre>

      {file.findings.length > 0 && <FindingList findings={file.findings} />}
    </div>
  );
}

/**
 * The findings in this file, listed under it.
 *
 * A gutter mark says *where*; it cannot say what is wrong. Rather than a
 * tooltip — unreachable by keyboard and invisible on touch — each one is a
 * link to its line.
 */
function FindingList({ findings }: { findings: Finding[] }) {
  const ordered = [...findings].sort(
    (a, b) => compareSeverity(a.severity, b.severity) || (a.line ?? 0) - (b.line ?? 0),
  );

  return (
    <div className="border-t border-border bg-surface p-3">
      <h2 className="mb-2 text-xs font-semibold text-fg">
        {findings.length} in this file
      </h2>
      <ul className="space-y-1.5">
        {ordered.map((finding) => (
          <li key={finding.id} className="flex items-baseline gap-2 text-xs">
            <SeverityBadge severity={finding.severity} showLabel={false} />
            <a
              href={`#L${finding.line ?? 1}`}
              className="tabular shrink-0 font-mono text-fg-subtle hover:text-fg"
            >
              {finding.line ?? "—"}
            </a>
            <span className="text-fg-muted">{finding.title}</span>
            {finding.suppressed && (
              <span className="shrink-0 text-fg-subtle">accepted</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
