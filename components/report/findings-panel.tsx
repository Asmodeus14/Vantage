"use client";

import * as React from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Search, X } from "lucide-react";

import { CodeSnippet } from "@/components/report/code-snippet";
import { AiActions } from "@/components/report/ai-actions";
import { SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Kbd } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";
import {
  CATEGORY_LABELS,
  CONFIDENCE_HINTS,
  CONFIDENCE_LABELS,
  compareSeverity,
} from "@/lib/severity";
import { cn, pluralise } from "@/lib/utils";
import { SEVERITIES } from "@/lib/types";
import type { Category, Finding, Report, Severity } from "@/lib/types";

export function FindingsPanel({
  report,
  initialQuery = "",
  onQueryChange,
  initialOnlyNew = false,
  onOnlyNewChange,
}: {
  report: Report;
  /**
   * Seeds the filter — the Activity tab uses it to hand over a file path.
   * Applied on change rather than only on mount, because the panel stays
   * mounted while another tab is showing.
   */
  initialQuery?: string;
  /**
   * Fired when the user changes the filter, so the containing view can put it
   * in the URL. Optional: the panel works standalone without it.
   */
  onQueryChange?: (query: string) => void;
  /** Start with the "New" filter on — the Overview delta links in this way. */
  initialOnlyNew?: boolean;
  onOnlyNewChange?: (onlyNew: boolean) => void;
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [severities, setSeverities] = React.useState<Set<Severity>>(new Set());
  const [category, setCategory] = React.useState<Category | "all">("all");
  const [onlyNew, setOnlyNew] = React.useState(initialOnlyNew);
  const [expanded, setExpanded] = React.useState<string | null>(
    report.findings[0]?.id ?? null,
  );

  // An empty `initialQuery` must not clobber what the user has typed, so this
  // only ever applies a real incoming value. It deliberately does not call
  // `onQueryChange` — the value came from outside, and echoing it back would
  // be a loop.
  React.useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  React.useEffect(() => {
    if (initialOnlyNew) setOnlyNew(true);
  }, [initialOnlyNew]);

  /** Every user-driven filter change goes through here, so none escapes the URL. */
  const updateQuery = React.useCallback(
    (next: string) => {
      setQuery(next);
      onQueryChange?.(next);
    },
    [onQueryChange],
  );

  const updateOnlyNew = React.useCallback(
    (next: boolean) => {
      setOnlyNew(next);
      onOnlyNewChange?.(next);
    },
    [onOnlyNewChange],
  );

  /**
   * Fingerprints that appeared since the previous analysis. A `Set` because the
   * list is checked once per finding per render, and `delta.new` is an array on
   * the wire.
   */
  const newPrints = React.useMemo(
    () => new Set(report.delta?.new ?? []),
    [report.delta],
  );

  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const categories = React.useMemo(() => {
    const present = new Set(report.findings.map((finding) => finding.category));
    return Array.from(present).sort();
  }, [report.findings]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.findings
      .filter((finding) => {
        if (severities.size > 0 && !severities.has(finding.severity)) return false;
        if (category !== "all" && finding.category !== category) return false;
        if (onlyNew && !newPrints.has(finding.fingerprint)) return false;
        if (!needle) return true;
        return (
          finding.title.toLowerCase().includes(needle) ||
          finding.description.toLowerCase().includes(needle) ||
          (finding.file ?? "").toLowerCase().includes(needle) ||
          finding.rule_id.toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) =>
          compareSeverity(a.severity, b.severity) ||
          (a.file ?? "").localeCompare(b.file ?? ""),
      );
  }, [report.findings, query, severities, category, onlyNew, newPrints]);

  // `/` focuses search; j/k move through the list — familiar from pagers and
  // review tools. None of these shadow a browser binding.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const index = visible.findIndex((finding) => finding.id === expanded);
        const next =
          event.key === "j"
            ? Math.min(index + 1, visible.length - 1)
            : Math.max(index - 1, 0);
        const target = visible[next === -1 ? 0 : next];
        if (target) {
          setExpanded(target.id);
          listRef.current
            ?.querySelector(`[data-finding="${target.id}"]`)
            ?.scrollIntoView({ block: "nearest" });
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, expanded]);

  const toggleSeverity = (severity: Severity) => {
    setSeverities((previous) => {
      const next = new Set(previous);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  const filtered =
    severities.size > 0 || category !== "all" || query.trim() !== "" || onlyNew;

  const clearFilters = () => {
    updateQuery("");
    setSeverities(new Set());
    setCategory("all");
    updateOnlyNew(false);
  };

  if (report.findings.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CheckCircle2}
          title="No findings"
          description="Every rule that applied to this project passed. That is a genuine result, not an error — the rule set is listed in the docs."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Filter by title, file or rule…"
            className="h-8 pl-8 pr-16 text-xs"
            aria-label="Filter findings"
          />
          {!query && (
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by severity">
          {SEVERITIES.filter((severity) => report.severity_counts[severity] > 0).map(
            (severity) => {
              const active = severities.has(severity);
              return (
                <button
                  key={severity}
                  type="button"
                  onClick={() => toggleSeverity(severity)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border px-1.5 py-1 transition-colors duration-(--duration-fast)",
                    active
                      ? "border-accent bg-accent-subtle"
                      : "border-transparent hover:bg-surface-hover",
                  )}
                >
                  {/* A filter is one of the few places severity is the
                      subject rather than an attribute, so it keeps the chip. */}
                  <span className="flex items-center gap-1">
                    <SeverityBadge severity={severity} chip />
                    <span className="tabular text-xs text-fg-muted">
                      {report.severity_counts[severity]}
                    </span>
                  </span>
                </button>
              );
            },
          )}
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category | "all")}
          aria-label="Filter by category"
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-fg hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>

        {/*
          Only offered when there is a comparison to filter against. A "New"
          control on a first analysis would match nothing and imply the report
          is missing something.
        */}
        {newPrints.size > 0 && (
          <button
            type="button"
            onClick={() => updateOnlyNew(!onlyNew)}
            aria-pressed={onlyNew}
            className={cn(
              "h-8 rounded-md border px-2 text-xs transition-colors duration-(--duration-fast)",
              onlyNew
                ? "border-accent bg-accent-subtle text-fg"
                : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            New <span className="tabular text-fg-subtle">{newPrints.size}</span>
          </button>
        )}

        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden />
            Clear
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-fg-subtle">
        <span>
          {visible.length} of {report.findings.length}{" "}
          {pluralise(report.findings.length, "finding")}
        </span>
        <span className="hidden sm:inline">
          <Kbd>j</Kbd> <Kbd>k</Kbd> to move
        </span>
      </div>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Search}
            title="Nothing matches those filters"
            description="Try a different search term, or clear the filters to see all findings."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul ref={listRef} className="divide-y divide-border">
            {visible.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                report={report}
                isNew={newPrints.has(finding.fingerprint)}
                expanded={expanded === finding.id}
                onToggle={() =>
                  setExpanded((current) => (current === finding.id ? null : finding.id))
                }
              />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function FindingRow({
  finding,
  report,
  isNew,
  expanded,
  onToggle,
}: {
  finding: Finding;
  report: Report;
  /** Appeared since the previous analysis of this repository. */
  isNew: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = `finding-panel-${finding.id}`;

  return (
    <li data-finding={finding.id} className={cn(expanded && "bg-surface-raised")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover"
      >
        <ChevronRight
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-fg-subtle transition-transform duration-(--duration-fast)",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
        <SeverityBadge severity={finding.severity} showLabel={false} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{finding.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
            {/*
              A word, not a badge. These sit beside a severity chip already, and
              a second coloured pill on the same row would compete with the one
              that carries the urgency.
            */}
            {isNew && (
              <>
                <span className="font-medium text-fg-muted">New</span>
                <span aria-hidden>·</span>
              </>
            )}
            {finding.file ? (
              <span className="font-mono">
                {finding.file}
                {finding.line ? `:${finding.line}` : ""}
              </span>
            ) : (
              <span className="italic">project-wide</span>
            )}
            <span aria-hidden>·</span>
            <span>{CATEGORY_LABELS[finding.category]}</span>
          </span>
        </span>

        {/*
          Only the genuinely uncertain. "Likely" was rendered on 45 of 50 rows,
          which made it a decorative stripe down the right edge rather than a
          signal — a flag every row carries is not a flag.
        */}
        {finding.confidence === "low" && (
          <Tooltip content={CONFIDENCE_HINTS.low} side="left">
            <span className="shrink-0 text-xs text-fg-subtle">
              {CONFIDENCE_LABELS.low}
            </span>
          </Tooltip>
        )}
      </button>

      {expanded && (
        <div id={panelId} className="space-y-3 border-t border-border px-3 py-3 pl-9">
          <p className="max-w-[80ch] text-pretty text-sm leading-relaxed text-fg">
            {finding.description}
          </p>

          {finding.snippet && finding.snippet_start_line && (
            <CodeSnippet
              code={finding.snippet}
              startLine={finding.snippet_start_line}
              highlightLine={finding.line}
            />
          )}

          {finding.remediation && (
            <div className="rounded-md border border-border bg-surface-sunken p-3">
              <h4 className="mb-1 text-xs font-semibold text-fg">How to fix</h4>
              <p className="text-pretty text-sm text-fg-muted">{finding.remediation}</p>
            </div>
          )}

          {/*
            Provenance belongs with the finding, not after the AI answer. When
            it sat last, the rule id read as a trailing line of the model's
            output rather than as the analyser's own attribution.
          */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-fg-subtle">{finding.rule_id}</span>
            {finding.references.map((reference) => (
              <a
                key={reference}
                href={reference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded text-accent transition-colors duration-(--duration-fast) hover:underline"
              >
                {new URL(reference).hostname.replace("www.", "")}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ))}
          </div>

          <AiActions finding={finding} reportId={report.id} />
        </div>
      )}
    </li>
  );
}
