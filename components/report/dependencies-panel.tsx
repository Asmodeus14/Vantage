"use client";

import * as React from "react";
import { Boxes } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pluralise } from "@/lib/utils";
import type { Report } from "@/lib/types";

export function DependenciesPanel({ report }: { report: Report }) {
  const [query, setQuery] = React.useState("");
  const [onlyVulnerable, setOnlyVulnerable] = React.useState(false);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.dependencies.filter((dependency) => {
      if (onlyVulnerable && dependency.vulnerabilities.length === 0) return false;
      if (!needle) return true;
      return dependency.name.toLowerCase().includes(needle);
    });
  }, [report.dependencies, query, onlyVulnerable]);

  const vulnerableCount = report.dependencies.filter(
    (dependency) => dependency.vulnerabilities.length > 0,
  ).length;

  if (report.dependencies.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Boxes}
          title="No dependency manifest found"
          description="This project has no package.json, so there were no declared dependencies to resolve or check against advisory data."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter packages…"
          className="h-8 min-w-56 flex-1 text-xs"
          aria-label="Filter dependencies"
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-fg-muted hover:border-border-strong">
          <input
            type="checkbox"
            checked={onlyVulnerable}
            onChange={(event) => setOnlyVulnerable(event.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          Only with advisories ({vulnerableCount})
        </label>
      </div>

      <p className="text-xs text-fg-subtle">
        {report.dependencies.length} direct{" "}
        {pluralise(report.dependencies.length, "dependency", "dependencies")}, checked
        against{" "}
        <a
          href="https://osv.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded text-accent hover:underline"
        >
          OSV.dev
        </a>{" "}
        by resolved version.
      </p>

      <Panel className="overflow-hidden">
        <ul className="divide-y divide-border">
          {visible.map((dependency) => (
            <li
              key={dependency.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
            >
              <span className="font-mono text-sm text-fg">{dependency.name}</span>

              <span className="tabular font-mono text-xs text-fg-subtle">
                {dependency.resolved_version ?? dependency.version_spec}
              </span>

              {dependency.resolved_version &&
                dependency.resolved_version !== dependency.version_spec && (
                  <span className="font-mono text-xs text-fg-subtle">
                    (spec {dependency.version_spec})
                  </span>
                )}

              {/* Plain text: this appeared as a bordered pill on half the
                  rows, which turned an attribute into forty containers. */}
              {dependency.is_dev && (
                <span className="shrink-0 text-xs text-fg-subtle">dev</span>
              )}

              {dependency.vulnerabilities.length > 0 && (
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {dependency.vulnerabilities.slice(0, 4).map((id) => (
                    <a
                      key={id}
                      href={`https://osv.dev/vulnerability/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      // The advisory ids are the only red on this screen, so
                      // the colour alone carries it — the tinted box and the
                      // shield icon beside it were both saying the same thing.
                      className="rounded font-mono text-[11px] text-critical hover:underline"
                    >
                      {id}
                    </a>
                  ))}
                  {dependency.vulnerabilities.length > 4 && (
                    <span className="text-xs text-fg-subtle">
                      +{dependency.vulnerabilities.length - 4}
                    </span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
