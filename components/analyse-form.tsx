"use client";

import * as React from "react";
import { FileArchive, Github, Upload, X } from "lucide-react";

import { RepoPicker } from "@/components/repo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { BROWSER_BACKEND_URL, MAX_UPLOAD_BYTES } from "@/lib/config";
import { useStartAnalysis } from "@/lib/use-start-analysis";
import { cn, formatBytes } from "@/lib/utils";
import type { ApiErrorBody, JobStarted } from "@/lib/types";

const EXAMPLES = [
  { label: "expressjs/express", url: "https://github.com/expressjs/express" },
  { label: "sindresorhus/got", url: "https://github.com/sindresorhus/got" },
  { label: "chalk/chalk", url: "https://github.com/chalk/chalk" },
] as const;

export function AnalyseForm() {
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /*
    One submit lifecycle for both paths, shared with the report page's
    "Analyse again". The `submitting` flag deliberately stays set through the
    navigation — see the note in the hook — and having two copies of that rule
    is how one of them eventually stops obeying it.
  */
  const {
    start: startAnalysis,
    goToJob,
    submitting,
    setSubmitting,
    error,
    setError,
  } = useStartAnalysis();

  // Shared with the report page's "Analyse again", so the two cannot drift
  // apart on the `submitting` lifecycle — see `lib/use-start-analysis.ts`.
  async function submitRepository(event: React.FormEvent) {
    event.preventDefault();
    await startAnalysis(url);
  }

  async function submitUpload(selected: File) {
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError({
        message: "That file isn't a ZIP archive.",
        detail: "Compress the project folder as .zip, or analyse from a GitHub URL instead.",
      });
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError({
        message: `That archive is ${formatBytes(selected.size)}.`,
        detail: `The upload limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Analysing from a GitHub URL has no such limit.`,
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.append("file", selected);

    /*
      The upload goes straight to the API, so it cannot carry the session
      cookie — it is HttpOnly and first-party to this origin. Without a ticket
      a signed-in user's upload is recorded as anonymous and never appears in
      their History.

      Best-effort: signed out, this returns 204 and the upload proceeds
      unattributed, which is a supported flow rather than a failure.
    */
    const ticket = await fetch("/api/auth/upload-ticket", { method: "POST" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (ticket?.ticket) form.append("ticket", ticket.ticket);

    try {
      // Posted straight to the API: serverless request bodies are capped at a
      // few megabytes, far below what a project archive needs.
      const response = await fetch(`${BROWSER_BACKEND_URL}/api/analyze/upload`, {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) {
        const failure = body as ApiErrorBody;
        setError({ message: failure.message, ...(failure.detail && { detail: failure.detail }) });
        setSubmitting(false);
        setFile(null);
        return;
      }
      // As above: stays pending through the navigation.
      goToJob((body as JobStarted).job_id);
    } catch {
      setError({
        message: "Upload failed.",
        detail: "Could not reach the analysis server.",
      });
      setSubmitting(false);
      setFile(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitRepository} className="space-y-3">
        <label htmlFor="repo-url" className="block text-sm font-medium text-fg">
          Repository URL
        </label>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Github
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <Input
              id="repo-url"
              ref={inputRef}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="github.com/owner/repository"
              className="pl-8.5 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="repo-url-hint"
              disabled={submitting}
            />
          </div>
          {/* Renders only when signed in — the list is the user's own. */}
          <RepoPicker
            onSelect={(selected) => {
              setUrl(selected);
              inputRef.current?.focus();
            }}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!url.trim() || submitting}
            loading={submitting}
          >
            {/* No arrow. The word is the action; the icon was decoration
                inside the loudest element on the page. */}
            Analyse
          </Button>
        </div>

        <p id="repo-url-hint" className="text-xs text-fg-muted">
          Any public repository. Nothing is installed or executed — the source is
          read, analysed and discarded.
        </p>
      </form>

      {/* Plain links. Three bordered pills for three examples was more
          furniture than the suggestion is worth. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-fg-subtle">Try</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.url}
            type="button"
            onClick={() => {
              setUrl(example.url);
              inputRef.current?.focus();
            }}
            className="rounded font-mono text-fg-muted underline decoration-border underline-offset-2 transition-colors duration-(--duration-fast) hover:text-fg hover:decoration-fg-subtle"
          >
            {example.label}
          </button>
        ))}
      </div>

      {error && (
        <ErrorState
          title="Couldn't start the analysis"
          description={error.message}
          {...(error.detail && { detail: error.detail })}
          onRetry={() => setError(null)}
        />
      )}

      {/* Secondary path: for code that isn't on GitHub. Collapsed it is a
          line of text, not a card — a container around a closed disclosure
          gave the fallback the same weight as the primary input. */}
      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg [&::-webkit-details-marker]:hidden">
          <Upload className="size-3.5" aria-hidden />
          Upload a ZIP archive instead
        </summary>

        <div className="mt-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
            className={cn(
              "rounded-lg border border-dashed p-6 text-center transition-colors duration-(--duration-fast)",
              dragging ? "border-accent bg-accent-subtle" : "border-border",
            )}
          >
            <FileArchive className="mx-auto mb-2 size-5 text-fg-subtle" aria-hidden />

            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-mono text-fg">{file.name}</span>
                <span className="text-fg-subtle">({formatBytes(file.size)})</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded p-0.5 text-fg-subtle hover:text-fg"
                  aria-label="Remove selected file"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                Drop a .zip here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded text-accent underline-offset-2 hover:underline"
                >
                  choose a file
                </button>
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) setFile(selected);
                event.target.value = "";
              }}
            />

            <p className="mt-2 text-xs text-fg-subtle">
              Up to {formatBytes(MAX_UPLOAD_BYTES)}. Dependency folders are skipped
              automatically — there is no need to prune anything first.
            </p>
          </div>

          {file && (
            <Button
              variant="primary"
              className="mt-3 w-full"
              onClick={() => void submitUpload(file)}
              loading={submitting}
            >
              Analyse {file.name}
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}
