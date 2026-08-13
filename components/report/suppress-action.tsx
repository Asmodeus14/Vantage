"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/use-session";
import type { Finding } from "@/lib/types";

/**
 * "Not an issue" — accept a finding so it stops appearing on every re-run.
 *
 * Only rendered for the report's owner. A control that always 403s is worse
 * than an absent one, and the reason it would fail (this report isn't yours,
 * or you aren't signed in) is not something a button can usefully say.
 *
 * The reason field is optional but asked for, because the person who has to
 * decide whether to un-accept this in six months is usually not the person
 * accepting it today.
 */
export function SuppressAction({
  finding,
  reportId,
  canSuppress,
}: {
  finding: Finding;
  reportId: string;
  /** The viewer owns this report and it came from a repository. */
  canSuppress: boolean;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!user || !canSuppress) return null;

  const url = `/api/reports/${encodeURIComponent(reportId)}/findings/${encodeURIComponent(finding.id)}/suppression`;

  async function send(method: "PUT" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ reason }) : undefined,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "That didn't work. Try again.");
        return;
      }
      setOpen(false);
      setReason("");
      // The server recomputes the score and the counts, so re-fetch rather than
      // patching local state — otherwise the header and the list disagree.
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (finding.suppressed) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-fg-subtle">
          Accepted
          {finding.suppression_reason && ` — ${finding.suppression_reason}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => send("DELETE")}
        >
          <Undo2 aria-hidden />
          {busy ? "Restoring…" : "Restore"}
        </Button>
        {error && <span className="text-critical">{error}</span>}
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Not an issue
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send("PUT");
      }}
    >
      <Input
        autoFocus
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        placeholder="Why is this acceptable? (optional)"
        aria-label="Reason for accepting this finding"
        className="h-8 min-w-56 flex-1 text-xs"
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Saving…" : "Accept"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      {error && <span className="text-xs text-critical">{error}</span>}
    </form>
  );
}
