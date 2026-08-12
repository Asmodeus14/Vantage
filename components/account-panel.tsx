"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { useSession } from "@/lib/use-session";

/**
 * The connected GitHub account.
 *
 * Read-mostly, like the rest of Settings: it reports what is true rather than
 * offering fields this UI cannot change. The two things it *can* do — grant
 * private-repository access, and sign out — are both real actions with visible
 * consequences.
 */
export function AccountPanel() {
  const { user, configured, reason, loading } = useSession();
  const params = useSearchParams();
  const authError = params.get("auth_error");

  return (
    <section>
      <h2 className="border-b border-border pb-2 text-[13px] font-semibold tracking-tight text-fg">
        Account
      </h2>

      <div className="pt-3">
        {authError && (
          <ErrorState
            title="Sign-in didn't complete"
            description={authError}
            className="mb-4"
          />
        )}

        {loading ? (
          <p className="text-sm text-fg-muted">Checking…</p>
        ) : user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                // One 32px avatar; see the note in user-menu.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full"
                />
              ) : null}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-fg">
                  {user.name ?? user.login}
                </div>
                <div className="truncate font-mono text-xs text-fg-subtle">
                  {user.login}
                </div>
              </div>
            </div>

            <dl className="space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-fg-muted">Reports</dt>
                <dd className="text-fg">Attributed to this account.</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-fg-muted">GitHub limit</dt>
                <dd className="text-fg">
                  5,000 requests an hour, using your own token.
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-fg-muted">Private repos</dt>
                <dd className="text-fg">
                  {user.can_read_private_repositories
                    ? "Readable."
                    : "Not granted."}
                </dd>
              </div>
            </dl>

            {!user.can_read_private_repositories && (
              <div className="max-w-[62ch] space-y-2 border-t border-border pt-3">
                <p className="text-xs text-fg-muted">
                  To analyse private repositories, GitHub requires the{" "}
                  <span className="font-mono text-fg">repo</span> scope — which
                  grants read <em>and write</em> access to every private
                  repository on your account. Vantage only ever reads, but
                  the permission itself is that broad, so it is not requested
                  unless you ask for it.
                </p>
                <Button asChild variant="secondary" size="sm">
                  <a href="/api/auth/github/login?private=1&next=/settings">
                    Grant private repository access
                  </a>
                </Button>
              </div>
            )}

            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        ) : configured ? (
          <div className="max-w-[62ch] space-y-3">
            <p className="text-sm text-fg-muted">
              Signing in attributes reports to you, so history shows your
              analyses rather than everyone&rsquo;s, and spends your GitHub rate
              limit instead of this server&rsquo;s shared one.
            </p>
            <Button asChild variant="secondary" size="sm">
              <a href="/api/auth/github/login?next=/settings">
                Sign in with GitHub
              </a>
            </Button>
          </div>
        ) : (
          <div className="max-w-[62ch] space-y-1">
            <p className="text-sm text-fg-muted">
              {reason ?? "Sign-in is not configured on this server."}
            </p>
            <p className="text-xs text-fg-subtle">
              Public repositories can still be analysed without signing in.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
