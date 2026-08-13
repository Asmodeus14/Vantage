"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Lock, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/use-session";
import { formatRelativeTime } from "@/lib/utils";
import type { RepositoryOption } from "@/lib/types";

/**
 * Pick a repository instead of pasting its URL.
 *
 * Only rendered when signed in — the list comes from the user's own GitHub
 * token, so there is nothing to show otherwise, and a disabled control beside
 * a URL field that already works would be noise.
 *
 * The list is fetched when the popover first opens, not on mount. Most visits
 * paste a URL and never touch this, and spending one of the account's hourly
 * GitHub requests on every page load to populate a menu nobody opened is the
 * kind of cost that only shows up as a rate limit later.
 */
export function RepoPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const { user } = useSession();
  const [open, setOpen] = React.useState(false);
  const [repos, setRepos] = React.useState<RepositoryOption[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open || repos !== null) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/auth/repositories");
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.message ?? "Could not load your repositories.");
          setRepos([]);
          return;
        }
        setRepos(body as RepositoryOption[]);
      } catch {
        if (!cancelled) {
          setError("Could not reach the server.");
          setRepos([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, repos]);

  const visible = React.useMemo(() => {
    if (!repos) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return repos;
    return repos.filter((repo) =>
      repo.full_name.toLowerCase().includes(needle),
    );
  }, [repos, query]);

  if (!user) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Choose one of your repositories"
      >
        Your repos
        <ChevronDown className="size-3.5" aria-hidden />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[22rem] rounded-md border border-border bg-surface p-2 shadow-sm"
        >
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter repositories…"
              aria-label="Filter repositories"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {repos === null ? (
            <p className="px-1 py-6 text-center text-xs text-fg-subtle">
              Loading your repositories…
            </p>
          ) : error ? (
            // Verbatim, and it names the way out: the URL field still works.
            <p className="px-1 py-4 text-xs text-fg-muted">{error}</p>
          ) : visible.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-fg-subtle">
              {repos.length === 0
                ? "No repositories found for this account."
                : "Nothing matches that."}
            </p>
          ) : (
            <ul className="scrollbar-thin max-h-72 overflow-y-auto">
              {visible.map((repo) => (
                <li key={repo.full_name}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(
                        repo.html_url ?? `https://github.com/${repo.full_name}`,
                      );
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover"
                  >
                    <span className="flex w-full items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-fg">
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <Lock
                          className="size-3 shrink-0 text-fg-subtle"
                          aria-label="Private"
                        />
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                      {repo.language && <span>{repo.language}</span>}
                      {repo.language && repo.pushed_at && (
                        <span aria-hidden>·</span>
                      )}
                      {repo.pushed_at && (
                        <span>{formatRelativeTime(repo.pushed_at)}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
