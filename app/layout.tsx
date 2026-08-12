import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — repository analysis`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // The manifest existed but nothing referenced it, so it was never served —
  // and it pointed at three icon files that did not exist.
  manifest: "/manifest.json",
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: "website",
  },
  // app/icon.png and app/apple-icon.png are picked up by file convention;
  // they do not need declaring here.
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes sets the class on <html> before
    // React hydrates, which is an intentional mismatch.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
