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
type SessionBody = Omit<SessionState, "loading">;

/**
 * One request per document, however many components ask.
 *
 * Three components call `useSession`, and the home page mounts two of them —
 * the header menu and the repo picker. Each used to issue its own
 * `/api/auth/me`; a Lighthouse trace caught both on one load, taking 2.3s and
 * 2.1s against a free-tier API that sleeps. Every caller gets the same answer,
 * so they share one request.
 *
 * Module scope is the right lifetime because it matches the session's: signing
 * in is an OAuth redirect and signing out is a form POST, so both replace the
 * document and reset this. Nothing can change the session without a page load,
 * so nothing can leave this stale.
 */
let inFlight: Promise<SessionBody> | null = null;

function loadSession(): Promise<SessionBody> {
  inFlight ??= (async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      return (await response.json()) as SessionBody;
    } catch {
      // Cleared rather than kept, so a later mount retries instead of
      // inheriting one unlucky network moment for the rest of the page's life.
      inFlight = null;
      return {
        user: null,
        configured: false,
        reason: "Could not reach the server to check your session.",
      };
    }
  })();

  return inFlight;
}

export function useSession(): SessionState {
  const [state, setState] = React.useState<SessionState>({
    user: null,
    configured: false,
    reason: null,
    loading: true,
  });

  React.useEffect(() => {
    let cancelled = false;

    void loadSession().then((body) => {
      if (!cancelled) setState({ ...body, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
