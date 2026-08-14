import { ImageResponse } from "next/og";

import { api } from "@/lib/api";
import { authHeaders } from "@/lib/session";
import { repoShortName } from "@/lib/utils";

export const alt = "Vantage analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
  The severity ramp and the surface colours, as literal hex.

  `ImageResponse` renders in Satori, which has no CSS custom properties and no
  Tailwind — so the values in `app/globals.css` cannot be referenced and have to
  be repeated here. That duplication is the price of a preview image; the note
  in `globals.css` beside the ramp points back at this file so the two cannot
  drift silently.

  Derived from the HSL tokens: --canvas, --critical, --high, --medium, --low,
  --success.
*/
const CANVAS = "#0e1116";
const SURFACE = "#161b22";
const BORDER = "#272e38";
const FG = "#e6edf3";
const FG_MUTED = "#9aa4b2";
const CRITICAL = "#c91d3c";
const HIGH = "#b84d0f";
const MEDIUM = "#976611";
const LOW = "#1f65d6";
const SUCCESS = "#1c8252";

/** Mirrors `scoreColour` in `lib/severity.ts`, which returns class names. */
function scoreHex(value: number): string {
  if (value >= 90) return SUCCESS;
  if (value >= 80) return LOW;
  if (value >= 70) return MEDIUM;
  if (value >= 60) return HIGH;
  return CRITICAL;
}

/**
 * The card a shared report link renders as.
 *
 * Report URLs have always been shareable and the README says so, but the page
 * set only `openGraph.description` — so a link posted in Slack, Discord or a
 * tweet appeared as a bare URL. Every share was a wasted impression.
 *
 * Deliberately the same information the report header leads with: repository,
 * score, grade, and the severity split. Someone who sees this card and clicks
 * should find exactly what it promised.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let report;
  try {
    report = await api.getReport(id, { headers: await authHeaders() });
  } catch {
    /*
      Every failure becomes the fallback card. Deliberately a bare `catch`,
      which is not the house style anywhere else in this codebase.

      The first version re-threw anything that was not an `ApiError`, on the
      reasoning that an unexpected error should be visible. That is right for
      an endpoint and wrong for this one: with the backend unreachable it
      returned a 500 and no image at all, and the failure mode of a preview
      image is that a link someone shared looks broken to everyone who sees
      it. There is nothing a reader can do with the error, and no version of
      "no card" that is worse than "the site is down".
    */
    return new ImageResponse(<Fallback />, size);
  }

  const score = report.effective_score ?? report.score;
  const counts = report.severity_counts;
  const title =
    repoShortName(report.source.repository) ??
    report.source.filename ??
    "Analysis";

  const severities = [
    { label: "Critical", value: counts.critical, colour: CRITICAL },
    { label: "High", value: counts.high, colour: HIGH },
    { label: "Medium", value: counts.medium, colour: MEDIUM },
    { label: "Low", value: counts.low, colour: LOW },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ display: "flex", fontSize: 24, color: FG_MUTED, letterSpacing: 2 }}>
              VANTAGE
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 68,
                fontWeight: 700,
                color: FG,
                marginTop: 16,
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
            {report.source.ref && (
              <div style={{ display: "flex", fontSize: 26, color: FG_MUTED, marginTop: 12 }}>
                {report.source.ref}
                {report.source.commit ? ` · ${report.source.commit.slice(0, 7)}` : ""}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div
              style={{
                display: "flex",
                fontSize: 140,
                fontWeight: 700,
                lineHeight: 1,
                color: scoreHex(score.value),
              }}
            >
              {score.value}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: FG_MUTED, marginTop: 8 }}>
              Grade {score.grade}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 20 }}>
            {severities.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: "16px 28px",
                  minWidth: 150,
                }}
              >
                <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: s.colour }}>
                  {s.value}
                </div>
                <div style={{ display: "flex", fontSize: 22, color: FG_MUTED, marginTop: 4 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", fontSize: 24, color: FG_MUTED, marginTop: 28 }}>
            {report.project.analysed_files.toLocaleString()} files ·{" "}
            {report.findings.length} findings
            {report.delta
              ? ` · ${report.delta.new.length} new, ${report.delta.resolved.length} resolved since the last analysis`
              : ""}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Fallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: CANVAS,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: FG_MUTED, letterSpacing: 3 }}>
        VANTAGE
      </div>
      <div style={{ display: "flex", fontSize: 44, color: FG, marginTop: 20 }}>
        Repository analysis
      </div>
    </div>
  );
}
