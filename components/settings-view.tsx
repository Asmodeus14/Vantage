"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";

import { AccountPanel } from "@/components/account-panel";
import { ThemeToggle } from "@/components/theme-provider";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Kbd } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HealthResponse } from "@/lib/types";

/**
 * Settings is deliberately read-mostly.
 *
 * Server configuration lives in the server's environment — showing an editable
 * field for something this UI cannot change would be a lie. What it does offer
 * is a clear account of what is configured and what that means for the product.
 */
export function SettingsView() {
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (response.ok) setHealth((await response.json()) as HealthResponse);
      } catch {
        setHealth(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Appearance is stored in this browser. Everything else is server
          configuration, shown here so you can see what is active.
        </p>
      </header>

      <div className="space-y-8">
        <React.Suspense
          fallback={<p className="text-sm text-fg-muted">Checking your account…</p>}
        >
          <AccountPanel />
        </React.Suspense>

        <Panel>
          <PanelHeader>
            <PanelTitle>Appearance</PanelTitle>
          </PanelHeader>
          <PanelBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fg">Theme</p>
              <p className="text-xs text-fg-muted">
                Follows your system setting unless you choose otherwise.
              </p>
            </div>
            <ThemeToggle />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Server capabilities</PanelTitle>
            {loading && <Loader2 className="size-3.5 animate-spin text-fg-subtle" aria-hidden />}
          </PanelHeader>
          <PanelBody className="space-y-3">
            {health === null && !loading ? (
              <p className="text-sm text-fg-muted">
                The analysis server is unreachable, so its configuration is
                unknown.
              </p>
            ) : health ? (
              <>
                <Capability
                  ok={health.ai.available}
                  label="AI actions"
                  detail={
                    health.ai.available
                      ? `Available using ${health.ai.model}.`
                      : (health.ai.reason ?? "Unavailable.")
                  }
                  note={
                    health.ai.available
                      ? undefined
                      : "Analysis is unaffected — only Explain, Propose fix and Generate test require a model."
                  }
                />
                <Capability
                  ok={health.database.available}
                  label="Report history"
                  detail={
                    health.database.available
                      ? "Reports are stored and survive restarts."
                      : (health.database.detail ?? "Not configured.")
                  }
                />
                <Capability
                  ok={health.auth.configured}
                  label="GitHub sign-in"
                  detail={
                    health.auth.configured
                      ? "Reports are attributed to your account, and analyses use your GitHub rate limit."
                      : (health.auth.reason ?? "Not configured.")
                  }
                  note={
                    health.auth.configured
                      ? undefined
                      : "Public repositories can still be analysed without signing in."
                  }
                />
                <div className="border-t border-border pt-3 text-xs text-fg-subtle">
                  <span className="font-mono">v{health.version}</span> ·{" "}
                  {health.environment}
                </div>
              </>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Keyboard shortcuts</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <dl className="space-y-2 text-sm">
              <Shortcut keys={["⌘/Ctrl", "K"]} description="Open the command palette" />
              <Shortcut keys={["/"]} description="Focus the findings filter" />
              <Shortcut keys={["j"]} description="Next finding" />
              <Shortcut keys={["k"]} description="Previous finding" />
              <Shortcut keys={["Esc"]} description="Close the palette or a dialog" />
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function Capability({
  ok,
  label,
  detail,
  note,
}: {
  ok: boolean;
  label: string;
  detail: string;
  note?: string;
}) {
  const Icon = ok ? Check : X;
  return (
    <div className="flex gap-2.5">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", ok ? "text-success" : "text-medium")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">
          {label}
          <span className="sr-only">: {ok ? "available" : "unavailable"}</span>
        </p>
        <p className="text-pretty text-xs text-fg-muted">{detail}</p>
        {note && <p className="mt-0.5 text-pretty text-xs text-fg-subtle">{note}</p>}
      </div>
    </div>
  );
}

function Shortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{description}</dt>
      <dd className="flex shrink-0 gap-1">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </dd>
    </div>
  );
}
