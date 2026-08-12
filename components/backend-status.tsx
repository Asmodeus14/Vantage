"use client";

import * as React from "react";
import { AlertCircle, Check, X } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { HealthResponse } from "@/lib/types";

/**
 * Service status.
 *
 * v2 rendered this as a fixed panel pinned over the lower-right corner at
 * z-9999, permanently. It belongs in the header at the size of its importance.
 *
 * Polling is slow (60s) and pauses when the tab is hidden. It costs the backend
 * nothing — the health endpoint performs no LLM call — but there is no reason
 * to ask a question whose answer rarely changes.
 */

type State = "checking" | "ok" | "degraded" | "unreachable";

const POLL_MS = 60_000;

export function BackendStatus() {
  const [state, setState] = React.useState<State>("checking");
  const [health, setHealth] = React.useState<HealthResponse | null>(null);

  const check = React.useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) {
        setState("unreachable");
        setHealth(null);
        return;
      }
      const body = (await response.json()) as HealthResponse;
      setHealth(body);
      setState(body.status === "ok" ? "ok" : "degraded");
    } catch {
      setState("unreachable");
      setHealth(null);
    }
  }, []);

  React.useEffect(() => {
    void check();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Silent while healthy.
  //
  // A permanent green dot reading "Ready" is decoration: it is true almost
  // always, so it carries no information and costs header space on every
  // screen. Status is worth showing exactly when it is bad — and then it
  // should be legible rather than a dot, because it explains why something
  // else on the page is not working.
  if (state === "ok" || state === "checking") return null;

  const tone =
    state === "degraded" ? "text-medium" : "text-critical";

  return (
    <Tooltip content={<StatusDetail state={state} health={health} />} side="bottom">
      <button
        type="button"
        onClick={() => void check()}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors duration-(--duration-fast) hover:bg-surface-hover",
          tone,
        )}
        aria-label={`Service status: ${STATE_LABEL[state]}. Click to re-check.`}
      >
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <span>{STATE_LABEL[state]}</span>
      </button>
    </Tooltip>
  );
}

const STATE_LABEL: Record<State, string> = {
  checking: "Checking",
  ok: "Ready",
  degraded: "Degraded",
  unreachable: "Offline",
};

function StatusDetail({
  state,
  health,
}: {
  state: State;
  health: HealthResponse | null;
}) {
  if (state === "unreachable") {
    return (
      <div className="max-w-64 space-y-1">
        <p className="font-medium">Analysis server unreachable</p>
        <p className="text-fg-muted">
          It may be waking up. Free hosting sleeps when idle and can take up to a
          minute to respond.
        </p>
      </div>
    );
  }

  if (!health) {
    return <p>Checking service status…</p>;
  }

  return (
    <div className="max-w-72 space-y-2">
      <Row
        ok={true}
        label="Analysis engine"
        detail={`v${health.version}`}
      />
      <Row
        ok={health.ai.available}
        label="AI actions"
        detail={
          health.ai.available
            ? (health.ai.model ?? "ready")
            : (health.ai.reason ?? "unavailable")
        }
      />
      <Row
        ok={health.database.available}
        label="Report history"
        detail={
          health.database.available
            ? "persisted"
            : (health.database.detail ?? "not configured")
        }
      />
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Mark = ok ? Check : X;
  return (
    <div className="flex gap-2">
      <Mark
        className={cn("mt-0.5 size-3 shrink-0", ok ? "text-success" : "text-medium")}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-pretty text-fg-muted">{detail}</div>
      </div>
    </div>
  );
}
