"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip } from "@/components/ui/tooltip";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

/**
 * GitHub serves avatars at whatever `?s=` asks for, defaulting to 460px. That
 * default was arriving as 21 kB for an 18px slot — larger than any script on
 * the page bar two. 64px covers the slot at 3x.
 *
 * Left untouched if the URL will not parse, because a working oversized avatar
 * beats a broken right-sized one.
 */
function avatarAt(url: string, size: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("s", String(size));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Sign in, or who you are signed in as.
 *
 * When sign-in is not configured the control is **disabled with the reason
 * shown**, never hidden — the same rule the AI actions follow. A missing button
 * leaves the user wondering whether the feature exists; a disabled one with an
 * explanation tells them it does and what is missing.
 */
export function UserMenu() {
  const { user, configured, reason, loading } = useSession();
  const pathname = usePathname();

  // Nothing at all until the first answer arrives. A flash of "Sign in"
  // followed by a username is worse than a beat of silence.
  if (loading) return null;

  if (user) {
    return (
      <Link
        href="/settings"
        // The username is hidden below `sm`, and the avatar is decorative, so
        // on a phone this link had no accessible name at all — a Lighthouse
        // audit reported it as an unnamed link in the tab order. The label does
        // not depend on the viewport, so neither does the name.
        aria-label={`Account settings — signed in as ${user.login}`}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px]",
          "text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-fg",
        )}
      >
        {user.avatar_url ? (
          // Avatars come from avatars.githubusercontent.com. Configuring
          // next/image remote patterns for one 18px image costs more than it
          // saves, so the plain element is deliberate.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarAt(user.avatar_url, 64)}
            alt=""
            width={18}
            height={18}
            className="size-[18px] rounded-full"
          />
        ) : null}
        <span className="hidden sm:inline">{user.login}</span>
      </Link>
    );
  }

  const target = `/api/auth/github/login?next=${encodeURIComponent(pathname)}`;

  if (!configured) {
    return (
      <Tooltip content={reason ?? "Sign-in is unavailable."} side="bottom">
        <span>
          <button
            type="button"
            disabled
            className="rounded-md px-1.5 py-1 text-[13px] text-fg-subtle opacity-60"
          >
            Sign in
          </button>
        </span>
      </Tooltip>
    );
  }

  return (
    <a
      href={target}
      className="rounded-md px-1.5 py-1 text-[13px] text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-fg"
    >
      Sign in
    </a>
  );
}
