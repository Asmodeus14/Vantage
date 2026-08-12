import { cn } from "@/lib/utils";

/**
 * Source excerpt with real line numbers and the offending line marked.
 *
 * `startLine` comes from the API rather than being assumed, because the excerpt
 * begins a few lines above the finding.
 */
export function CodeSnippet({
  code,
  startLine,
  highlightLine,
  className,
}: {
  code: string;
  startLine: number;
  highlightLine?: number | null;
  className?: string;
}) {
  const lines = code.split("\n");

  return (
    <div
      className={cn(
        "scrollbar-thin overflow-x-auto rounded-md border border-border bg-surface-sunken",
        className,
      )}
    >
      <pre className="min-w-full py-1.5 font-mono text-xs leading-relaxed">
        <code>
          {lines.map((line, index) => {
            const number = startLine + index;
            const active = highlightLine === number;
            return (
              <div
                key={number}
                className={cn(
                  "flex",
                  active && "bg-medium-bg",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "tabular sticky left-0 select-none border-r border-border bg-surface-sunken px-2 text-right",
                    active ? "font-medium text-medium" : "text-fg-subtle",
                  )}
                  style={{ minWidth: "3.25rem" }}
                >
                  {number}
                </span>
                <span
                  className={cn(
                    "whitespace-pre px-3",
                    active ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {line || " "}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
