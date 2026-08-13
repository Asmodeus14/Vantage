import {
  AlertTriangle,
  Bug,
  FileWarning,
  Info,
  OctagonAlert,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import type { Category, Confidence, Grade, Severity } from "@/lib/types";

/**
 * Presentation metadata for severities.
 *
 * Every severity pairs a colour with a distinct icon and a text label, so the
 * signal survives for colourblind users and in monochrome. v2 encoded severity
 * as colour plus an emoji, which fails both.
 */
export interface SeverityMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for a filled chip. */
  chip: string;
  /** Foreground-only, for icons and inline text. */
  text: string;
  /** Sort weight: lower is more urgent. */
  rank: number;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    label: "Critical",
    icon: OctagonAlert,
    chip: "bg-critical-bg text-critical border-critical-border",
    text: "text-critical",
    rank: 0,
  },
  high: {
    label: "High",
    icon: ShieldAlert,
    chip: "bg-high-bg text-high border-high-border",
    text: "text-high",
    rank: 1,
  },
  medium: {
    label: "Medium",
    icon: AlertTriangle,
    chip: "bg-medium-bg text-medium border-medium-border",
    text: "text-medium",
    rank: 2,
  },
  low: {
    label: "Low",
    icon: FileWarning,
    chip: "bg-low-bg text-low border-low-border",
    text: "text-low",
    rank: 3,
  },
  info: {
    label: "Info",
    icon: Info,
    chip: "bg-info-bg text-info border-info-border",
    text: "text-info",
    rank: 4,
  },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  security: "Security",
  dependencies: "Dependencies",
  correctness: "Correctness",
  quality: "Quality",
  performance: "Performance",
  testing: "Testing",
  configuration: "Configuration",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Confirmed",
  medium: "Likely",
  low: "Needs review",
};

/** Explains what a confidence level means, for a tooltip. */
export const CONFIDENCE_HINTS: Record<Confidence, string> = {
  high: "Deterministic check — this is definitely present.",
  medium: "Heuristic match. Very likely correct, but worth confirming.",
  low: "Pattern match that is legitimate in some contexts. Review before acting.",
};

export function gradeColour(grade: Grade): string {
  switch (grade) {
    case "A":
      return "text-success";
    case "B":
      return "text-low";
    case "C":
      return "text-medium";
    case "D":
      return "text-high";
    default:
      return "text-critical";
  }
}

export function scoreColour(value: number): string {
  if (value >= 90) return "text-success";
  if (value >= 80) return "text-low";
  if (value >= 70) return "text-medium";
  if (value >= 60) return "text-high";
  return "text-critical";
}

/**
 * The score to show for a listed report: adjusted for accepted findings when
 * any are, otherwise as analysed.
 *
 * Exists so History, the trend chart, the command palette and the report page
 * cannot answer "what did this score" differently. They did — the report page
 * excluded accepted findings and every list did not, so one report showed two
 * numbers depending on where you looked at it.
 */
export function displayScore(report: {
  score: number;
  effective_score?: number | null;
}): number {
  return report.effective_score ?? report.score;
}

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_META[a].rank - SEVERITY_META[b].rank;
}

export const DEFAULT_ICON: LucideIcon = Bug;
