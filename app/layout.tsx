import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { ThemeProvider } from "@/components/theme-provider";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

import "./globals.css";

/*
  Both are self-hosted by next/font — the files are emitted into the build and
  served from our own origin, so this adds no third-party request and no
  render-blocking stylesheet. That matters here: this app previously shipped
  system fonts only, specifically to avoid a webfont on the critical path.

  `display: "swap"` means text paints immediately in the fallback stack and
  reflows when the font arrives. For the monospace body that reflow is small,
  because the fallback is also monospace and advances identically.
*/
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/*
  Display only — the landing hero, section headings, and the scene's popup.
  Loaded at 400/700 rather than as a variable font because nothing here
  interpolates weight, and the two static cuts are smaller than the axis.
*/
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-pixelify-sans",
});

/*
  `description` is deliberately not here — it is rendered as JSX below instead.

  Next streams metadata rather than blocking the shell on it (default since
  15.2), so everything in this object is emitted *after* `</head>`, ~29 kB into
  the body. That is the right trade for us: it is why the shell flushes at
  457ms instead of waiting on the report's API call. But it means a consumer
  that reads the served HTML without running it never sees a description.

  Next already handles the crawlers — `htmlLimitedBots` makes metadata blocking
  for Googlebot, Bingbot, Twitterbot, Slackbot and the rest, and those do get a
  full `<head>`. The gap is everything else, including Lighthouse, whose
  user agent has not identified itself since v12:

    Mozilla/5.0 (Linux; Android 11; moto g power (2022)) … Mobile Safari/537.36

  React 19 hoists `<meta>` into the head wherever it is rendered, and this
  layout is in the first flush, so this lands in the initial `<head>` for
  everyone without giving up streamed metadata.
*/
export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — repository analysis`,
    template: `%s · ${APP_NAME}`,
  },
  applicationName: APP_NAME,
  // The manifest existed but nothing referenced it, so it was never served —
  // and it pointed at three icon files that did not exist.
  manifest: "/manifest.json",
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: "website",
  },
  /*
    Declared rather than left to the file convention, which emits only one
    `icon.*` even when several are present — it picked the PNG and dropped the
    SVG, so the theme-aware icon never reached the page.

    Order matters: the SVG is offered first and anything that understands it
    takes it, which is what makes the mark invert with the browser theme. The
    PNG stays as the fallback. apple-touch-icon has no dark variant because iOS
    composites it on its own background.
  */
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
};

// Matches --canvas in `app/globals.css` for each theme. These paint the
// browser chrome on mobile, so a stale value shows as a seam above the page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d3e4de" },
    { media: "(prefers-color-scheme: dark)", color: "#111d1d" },
  ],
};

/*
  This layout deliberately renders no chrome of its own.

  The product has three shells that share nothing visually — the marketing
  header on the landing page, the app header on the tool, and the icon rail on
  the dashboard — so each route group owns its own layout and this one is left
  holding only what is genuinely global: the document, the theme, the fonts and
  the analytics beacon.
*/
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes sets the class on <html> before
    // React hydrates, which is an intentional mismatch.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} ${pixelifySans.variable}`}
    >
      {/* Hoisted into <head> by React, in the first flush. See the note on
          `metadata` above for why it is not declared there. */}
      <meta name="description" content={APP_DESCRIPTION} />
      <body className="min-h-dvh bg-canvas antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        {/* Last in the body so its script is discovered after the page's own,
            and outside the route groups so a route that throws still reports
            the view. */}
        <Analytics />
      </body>
    </html>
  );
}
