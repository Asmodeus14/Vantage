"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import {
  Clock,
  FileSearch,
  Github,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";

import { Kbd } from "@/components/ui/input";
import { cn, repoShortName } from "@/lib/utils";
import type { ReportSummary } from "@/lib/types";
import { displayScore } from "@/lib/severity";

/** Shared open/close state so the header trigger and the ⌘K binding agree. */
const PaletteContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function usePaletteState() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K. Not bound to anything reserved by the browser.
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPaletteTrigger() {
  const context = React.useContext(PaletteContext);
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <button
      type="button"
      onClick={() => context?.setOpen(true)}
      className={cn(
        "hidden items-center gap-2 rounded-md border border-border bg-surface px-2 py-1",
        "text-xs text-fg-subtle transition-colors duration-(--duration-fast)",
        "hover:border-border-strong hover:text-fg-muted sm:flex",
      )}
      aria-label="Open command palette"
    >
      <Search className="size-3.5" aria-hidden />
      <span>Search…</span>
      <Kbd>{isMac ? "⌘" : "Ctrl"} K</Kbd>
    </button>
  );
}

/**
 * Wraps the app so the header trigger and the ⌘K binding share one state.
 * Renders the dialog itself, so callers only mount this once.
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const state = usePaletteState();
  return (
    <PaletteContext.Provider value={state}>
      {children}
      <CommandPalette />
    </PaletteContext.Provider>
  );
}

function CommandPalette() {
  const state = React.useContext(PaletteContext);
  const router = useRouter();
  const { setTheme } = useTheme();
  const [reports, setReports] = React.useState<ReportSummary[]>([]);

  const open = state?.open ?? false;

  // Load recent reports only when the palette first opens, so the header
  // doesn't issue a request on every page load.
  React.useEffect(() => {
    if (!open || reports.length) return;
    void (async () => {
      try {
        const response = await fetch("/api/reports?limit=8");
        if (response.ok) setReports((await response.json()) as ReportSummary[]);
      } catch {
        // A palette without history is still useful; fail quietly.
      }
    })();
  }, [open, reports.length]);

  const run = React.useCallback(
    (action: () => void) => {
      state?.setOpen(false);
      action();
    },
    [state],
  );

  if (!state) return null;

  return (
    <Dialog.Root open={state.open} onOpenChange={state.setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-[15%] z-50 w-[92vw] max-w-lg -translate-x-1/2",
              "overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98",
            )}
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search reports and run commands. Use arrow keys to navigate.
            </Dialog.Description>

            <Command loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                <Command.Input
                  placeholder="Search reports or run a command…"
                  className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>

              <Command.List className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
                <Command.Empty className="py-8 text-center text-sm text-fg-muted">
                  No matches.
                </Command.Empty>

                <Command.Group
                  heading={
                    <span className="text-xs font-medium text-fg-subtle">Actions</span>
                  }
                >
                  <Item
                    icon={FileSearch}
                    label="Analyse a repository"
                    onSelect={() => run(() => router.push("/"))}
                  />
                  <Item
                    icon={Clock}
                    label="View report history"
                    onSelect={() => run(() => router.push("/history"))}
                  />
                  <Item
                    icon={Settings}
                    label="Settings"
                    onSelect={() => run(() => router.push("/settings"))}
                  />
                  <Item
                    icon={Github}
                    label="Open GitHub"
                    onSelect={() =>
                      run(() =>
                        window.open("https://github.com/Asmodeus14", "_blank", "noopener"),
                      )
                    }
                  />
                </Command.Group>

                {reports.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="text-xs font-medium text-fg-subtle">
                        Recent reports
                      </span>
                    }
                  >
                    {reports.map((report) => (
                      <Item
                        key={report.id}
                        icon={FileSearch}
                        label={
                          repoShortName(report.source.repository) ||
                          report.source.filename ||
                          report.id
                        }
                        hint={`${displayScore(report)}/100 · ${report.total_findings} findings`}
                        onSelect={() => run(() => router.push(`/r/${report.id}`))}
                      />
                    ))}
                  </Command.Group>
                )}

                <Command.Group
                  heading={<span className="text-xs font-medium text-fg-subtle">Theme</span>}
                >
                  <Item icon={Sun} label="Light" onSelect={() => run(() => setTheme("light"))} />
                  <Item icon={Moon} label="Dark" onSelect={() => run(() => setTheme("dark"))} />
                  <Item
                    icon={Monitor}
                    label="System"
                    onSelect={() => run(() => setTheme("system"))}
                  />
                </Command.Group>
              </Command.List>
            </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Item({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: typeof Search;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={`${label} ${hint ?? ""}`}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg",
        "data-[selected=true]:bg-surface-hover",
      )}
    >
      <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="tabular shrink-0 text-xs text-fg-subtle">{hint}</span>}
    </Command.Item>
  );
}
