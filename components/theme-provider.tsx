"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

const ORDER = ["light", "dark", "system"] as const;
const LABELS = { light: "Light", dark: "Dark", system: "System" } as const;
const ICONS = { light: Sun, dark: Moon, system: Monitor };

/** Cycles light → dark → system. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Theme is unknowable until hydration; render a stable placeholder so the
  // markup matches and the layout doesn't jump.
  React.useEffect(() => setMounted(true), []);

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const Icon = mounted ? ICONS[current] : Monitor;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      title={mounted ? `Theme: ${LABELS[current]}. Switch to ${LABELS[next]}.` : "Theme"}
      aria-label={
        mounted ? `Theme: ${LABELS[current]}. Switch to ${LABELS[next]}.` : "Toggle theme"
      }
    >
      <Icon aria-hidden />
    </Button>
  );
}
