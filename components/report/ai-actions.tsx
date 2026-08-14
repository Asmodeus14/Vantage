"use client";

import * as React from "react";
import { Check, Copy, RotateCw } from "lucide-react";

import { CodeBlock } from "@/components/markdown/code-block";
import { Markdown } from "@/components/markdown/markdown";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { AIHealth, ApiErrorBody, Finding, HealthResponse } from "@/lib/types";

/**
 * Context-scoped AI actions.
 *
 * Not a chat: the user picks one operation and the server assembles the prompt
 * from stored analysis data. The context line states exactly what the model was
 * shown, so the answer can be judged rather than trusted.
 *
 * When AI is unconfigured or rate-limited the actions are disabled and the real
 * reason is shown. They are never hidden, and no canned text is ever
 * substituted for a model response.
 */

/*
 * No icons. A wand next to "Propose fix" is the visual shorthand for "magic
 * happens here", which is exactly the register this product should avoid — and
 * once it went, the flask and the info glyph were decorating two verbs that
 * needed no help. Three short labels in a row read faster without them.
 */
/*
 * `needsSource` distinguishes the two that have to produce code from the one
 * that does not. A dependency CVE or a project-wide finding is not anchored to
 * a line, so a diff and a test have nothing to be *of* — offering them meant
 * spending a real model request to be told INSUFFICIENT_CONTEXT. Explain still
 * works from the finding's own description, so it stays enabled.
 */
const ACTIONS = [
  { id: "explain", label: "Explain", needsSource: false },
  { id: "propose_fix", label: "Propose fix", needsSource: true },
  { id: "generate_test", label: "Generate test", needsSource: true },
] as const;

type ActionId = (typeof ACTIONS)[number]["id"];

interface Result {
  action: string;
  output: string;
  model: string | null;
  context: string;
  cached: boolean;
}

const INSUFFICIENT = "INSUFFICIENT_CONTEXT:";

export function AiActions({
  finding,
  reportId,
}: {
  finding: Finding;
  reportId: string;
}) {
  const [health, setHealth] = React.useState<AIHealth | null>(null);
  const [running, setRunning] = React.useState<ActionId | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<{ message: string; detail?: string } | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) return;
        const body = (await response.json()) as HealthResponse;
        if (!cancelled) setHealth(body.ai);
      } catch {
        // Leave health null: actions stay disabled with a neutral explanation.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = React.useCallback(
    async (action: ActionId) => {
      setRunning(action);
      setError(null);
      setResult(null);
      try {
        // Through this app's own route handler, not straight to the API: that
        // is what lets the call carry the session cookie.
        const response = await fetch(
          `/api/reports/${encodeURIComponent(reportId)}/findings/${encodeURIComponent(finding.id)}/ai`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
        const body = await response.json();
        if (!response.ok) {
          const failure = body as ApiErrorBody;
          setError({
            message: failure.message,
            ...(failure.detail && { detail: failure.detail }),
          });
          return;
        }
        setResult(body as Result);
      } catch {
        setError({
          message: "Couldn't reach the analysis server.",
          detail: "Check your connection and try again.",
        });
      } finally {
        setRunning(null);
      }
    },
    [finding.id, reportId],
  );

  const available = health?.available ?? false;
  const disabledReason =
    health === null
      ? "Checking whether AI is available…"
      : (health.reason ?? "AI actions are unavailable.");

  // A file is enough on its own: the server re-reads the repository for wider
  // context, so a finding with a path but no stored snippet is still workable.
  const hasSource = Boolean(finding.file) || Boolean(finding.snippet);
  const noSourceReason = finding.file
    ? `No source was captured for ${finding.file}.`
    : "This finding isn't anchored to a file, so there's no code to work from.";

  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="AI actions">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="text-xs font-medium text-fg-muted">Ask about this finding</h4>

        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((action) => {
            const blockedForSource = action.needsSource && !hasSource;
            const disabled = !available || blockedForSource;
            const reason = blockedForSource ? noSourceReason : disabledReason;

            const button = (
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                loading={running === action.id}
                onClick={() => void run(action.id)}
              >
                {action.label}
              </Button>
            );

            // A dead button with no reason is worse than no button.
            return disabled ? (
              <Tooltip key={action.id} content={reason} side="top">
                <span className="inline-block">{button}</span>
              </Tooltip>
            ) : (
              <React.Fragment key={action.id}>{button}</React.Fragment>
            );
          })}
        </div>
      </div>

      {available && !hasSource && (
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
          {noSourceReason} Explain still works from the finding itself.
        </p>
      )}

      {!available && (
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{disabledReason}</p>
      )}

      {running && <Thinking action={running} />}

      {error && !running && (
        <div
          role="alert"
          className="mt-3 flex max-w-[52rem] items-start gap-2.5 rounded-lg border border-critical-border bg-critical-bg px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">{error.message}</p>
            {error.detail && (
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{error.detail}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      {result && !running && (
        <Response result={result} onRegenerate={() => void run(result.action as ActionId)} />
      )}
    </section>
  );
}

/** Quiet working indicator. Names the operation instead of spinning anonymously. */
function Thinking({ action }: { action: ActionId }) {
  const label =
    action === "explain"
      ? "Reading the finding"
      : action === "propose_fix"
        ? "Working out a patch"
        : "Drafting a test";

  return (
    <p
      className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted"
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1 animate-skeleton rounded-full bg-fg-subtle"
            style={{ animationDelay: `${index * 160}ms`, animationDuration: "1.1s" }}
          />
        ))}
      </span>
      {label}…
    </p>
  );
}

function Response({
  result,
  onRegenerate,
}: {
  result: Result;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const insufficient = result.output.startsWith(INSUFFICIENT);
  const contextLine = [result.context, result.model, result.cached ? "cached" : null]
    .filter(Boolean)
    .join(" · ");

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked; the text remains selectable.
    }
  }

  return (
    <article className="group/response mt-3">
      {/*
        Capped near the prose measure: left unbounded, the copy and regenerate
        buttons sat at the far edge of the panel in several hundred pixels of
        empty space, disconnected from the answer they act on.

        The provenance line truncates rather than wraps, so the buttons keep a
        fixed position instead of dropping to a row of their own whenever the
        file path happens to be long.
      */}
      <header className="flex max-w-[52rem] items-center gap-2 text-[11px] text-fg-subtle">
        <span className="flex min-w-0 items-center gap-2 truncate" title={contextLine}>
          <span className="truncate font-mono">{result.context}</span>
          {result.model && (
            <>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap font-mono">{result.model}</span>
            </>
          )}
          {result.cached && (
            <>
              <span aria-hidden>·</span>
              <span>cached</span>
            </>
          )}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-(--duration-fast) sm:opacity-0 sm:group-hover/response:opacity-100 sm:focus-within:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={() => void copy()} title="Copy response">
            {copied ? (
              <Check className="text-success" aria-hidden />
            ) : (
              <Copy aria-hidden />
            )}
            <span className="sr-only">{copied ? "Response copied" : "Copy response"}</span>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRegenerate} title="Regenerate">
            <RotateCw aria-hidden />
            <span className="sr-only">Regenerate response</span>
          </Button>
        </span>
      </header>

      <div className="mt-2">
        {insufficient ? (
          <InsufficientContext message={result.output.slice(INSUFFICIENT.length).trim()} />
        ) : result.action === "propose_fix" ? (
          <>
            <CodeBlock code={result.output} language="diff" className="mt-0" />
            <p className="mt-1.5 text-xs text-fg-subtle">
              Review before applying. Vantage does not modify your working tree.
            </p>
          </>
        ) : (
          <Markdown>{result.output}</Markdown>
        )}
      </div>
    </article>
  );
}

/**
 * The model declining for lack of context is a legitimate answer, not a
 * failure — presenting it as an error would train users to distrust it.
 */
function InsufficientContext({ message }: { message: string }) {
  return (
    <div className="max-w-[52rem] rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
      <p className="text-[13px] font-medium text-fg">Not enough context to answer well</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{message}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-subtle">
        Findings carry only the lines around the issue. Wider file context is on
        the roadmap.
      </p>
    </div>
  );
}
