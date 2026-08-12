"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { highlight, languageLabel, normaliseLanguage } from "@/lib/highlighter";
import { cn } from "@/lib/utils";

/**
 * Fenced code block.
 *
 * Structure is deliberately flat: one surface, one hairline, a quiet header
 * carrying the language and a copy action, then the code. No nested cards, no
 * inner borders.
 *
 * The unhighlighted code renders immediately and is swapped for the highlighted
 * markup once Shiki resolves. Because both render the same text at the same
 * metrics, there is no reflow — only colour arriving.
 */
export function CodeBlock({
  code,
  language: rawLanguage,
  className,
}: {
  code: string;
  language?: string | undefined;
  className?: string;
}) {
  const language = normaliseLanguage(rawLanguage);
  const [html, setHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void highlight(code, language)
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        // Highlighting is an enhancement; plain code is a fine end state.
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  React.useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions; the code is still selectable.
    }
  }

  return (
    <figure
      className={cn(
        "group/code my-4 overflow-hidden rounded-lg border border-border bg-surface-sunken",
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5 pl-3 pr-1.5">
        <span className="select-none text-[11px] font-medium tracking-wide text-fg-subtle">
          {languageLabel(language)}
        </span>

        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium",
            "text-fg-subtle transition-colors duration-(--duration-fast)",
            "hover:bg-surface-hover hover:text-fg",
            "focus-visible:opacity-100",
            // Revealed on hover on pointer devices, always present for keyboard
            // and touch users.
            "opacity-100 sm:opacity-0 sm:group-hover/code:opacity-100 sm:focus-visible:opacity-100",
          )}
        >
          {copied ? (
            <>
              <Check className="size-3 text-success" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden />
              Copy
            </>
          )}
          <span className="sr-only">
            {copied ? "Code copied" : `Copy ${languageLabel(language)} code`}
          </span>
        </button>
      </figcaption>

      <div className="scrollbar-thin overflow-x-auto">
        {html ? (
          // Shiki escapes every token it emits and only ever receives plain
          // text from a fenced block, so no model-authored markup can reach
          // this. Raw HTML from the model is stripped upstream by
          // rehype-sanitize and is never parsed in the first place.
          <div className="shiki-host" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="px-3.5 py-3 font-mono text-[12.5px] leading-[1.6]">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </figure>
  );
}
