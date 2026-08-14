"use client";

import * as React from "react";
import { Check, GitPullRequest, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Posts the report's delta to a pull request as one comment.
 *
 * Collapsed to a link until asked for. The report page's job is the report;
 * this is a thing you do *with* it, and giving it a permanent form on the page
 * would put a text input in front of everyone who never comments on a PR.
 *
 * Only shown when the caller could actually succeed — the comment is posted as
 * the signed-in user on their own token, so for anyone else the control would
 * exist only to be refused.
 */
export function PrCommentAction({ reportId }: { reportId: string }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [commentUrl, setCommentUrl] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || state === "sending") return;

    setState("sending");
    setError(null);
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(reportId)}/pull-request-comment`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pull_request_url: url.trim() }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        // The backend's message is more specific than anything inventable
        // here — "that PR may be private" beats "something went wrong".
        setError([body?.message, body?.detail].filter(Boolean).join(" ") || "Failed.");
        setState("idle");
        return;
      }
      setCommentUrl(body.comment_url ?? null);
      setState("done");
    } catch (caught) {
      setError(describeError(caught).message);
      setState("idle");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) hover:text-fg hover:decoration-fg"
      >
        <GitPullRequest className="size-3" aria-hidden />
        Comment on a PR
      </button>
    );
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <Check className="size-3" aria-hidden />
        Comment posted
        {commentUrl && (
          <a
            href={commentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            View
          </a>
        )}
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="inline-flex flex-wrap items-center gap-1.5">
      <label htmlFor="pr-url" className="sr-only">
        Pull request URL
      </label>
      <Input
        id="pr-url"
        ref={inputRef}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repo/pull/123"
        className="h-7 w-[19rem] text-xs"
        disabled={state === "sending"}
      />
      <Button type="submit" size="sm" disabled={state === "sending" || !url.trim()}>
        {state === "sending" && <Loader2 className="size-3 animate-spin" aria-hidden />}
        {state === "sending" ? "Posting…" : "Post"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
      >
        Cancel
      </Button>
      {error && (
        <span className={cn("w-full text-critical")} role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
