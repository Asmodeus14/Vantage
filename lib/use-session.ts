"use client";

import * as React from "react";

export interface CurrentUser {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  scopes: string[];
  can_read_private_repositories: boolean;
}

export interface SessionState {
  user: CurrentUser | null;
  /** Whether sign-in can be offered at all on this deployment. */
  configured: boolean;
  /** Why it cannot, shown to the user verbatim. */
  reason: string | null;
  loading: boolean;
}

/**
 * The signed-in user, if any.
 *
 * Fetched from this app's own `/api/auth/me` rather than the API directly: the
 * session lives in an HttpOnly first-party cookie that script deliberately
 * cannot read, so only this server can resolve it.
 */
export function useSession(): SessionState {
  const [state, setState] = React.useState<SessionState>({
    user: null,
    configured: false,
    reason: null,
    loading: true,
  });

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await response.json()) as Omit<SessionState, "loading">;
        if (!cancelled) setState({ ...body, loading: false });
      } catch {
        if (!cancelled) {
          setState({
            user: null,
            configured: false,
            reason: "Could not reach the server to check your session.",
            loading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
