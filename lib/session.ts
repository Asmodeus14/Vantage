// Server-only by construction: `next/headers` and `node:crypto` both fail to
// resolve in a client component, so no `server-only` guard is needed.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_SECRET } from "@/lib/config";

/**
 * Session cookie and OAuth `state`.
 *
 * `state` is **signed rather than stored**. Keeping it in a server-side map
 * would fail roughly half the time under more than one worker — and Render runs
 * two — because the callback can land on a different process than the redirect.
 * A signed, self-describing value needs no shared storage.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

/**
 * Build a `state` carrying where to return to.
 *
 * Format: `<nonce>.<expiry>.<returnTo>.<signature>`. The nonce makes each one
 * distinct; the expiry bounds replay; the signature makes all of it
 * untamperable.
 */
export function createState(returnTo: string): string {
  const nonce = randomBytes(9).toString("base64url");
  const expires = String(Date.now() + STATE_TTL_MS);
  const target = encodeURIComponent(safeReturnTo(returnTo));
  const payload = `${nonce}.${expires}.${target}`;
  return `${payload}.${sign(payload)}`;
}

export interface StateResult {
  valid: boolean;
  returnTo: string;
  reason?: string;
}

export function verifyState(state: string | null): StateResult {
  const fallback = { valid: false, returnTo: "/" };
  if (!state) return { ...fallback, reason: "Missing state parameter." };

  const parts = state.split(".");
  if (parts.length !== 4) return { ...fallback, reason: "Malformed state." };

  const [nonce, expires, target, signature] = parts as [
    string,
    string,
    string,
    string,
  ];
  const expected = sign(`${nonce}.${expires}.${target}`);

  // Constant-time: a length mismatch would otherwise leak through timingSafeEqual
  // throwing rather than returning false.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ...fallback, reason: "State signature did not verify." };
  }

  if (Number(expires) < Date.now()) {
    return { ...fallback, reason: "Sign-in took too long. Try again." };
  }

  return { valid: true, returnTo: safeReturnTo(decodeURIComponent(target)) };
}

/**
 * Only ever return to a path on this site.
 *
 * Without this, `?next=https://evil.example` would turn sign-in into an open
 * redirect. `//host` and `\\host` are both browser-accepted protocol-relative
 * forms, so a leading-slash check alone is not enough.
 */
export function safeReturnTo(value: string): string {
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** The caller's session token, if they have one. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * `Authorization` header for a backend call made on the caller's behalf.
 *
 * Empty when signed out — every endpoint treats anonymous as a supported mode
 * rather than an error.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
