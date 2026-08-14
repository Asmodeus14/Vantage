/**
 * API contract — mirrors `app/schemas.py` on the backend.
 *
 * v2's dashboard guessed at response shapes (`getSolutionText` tried four
 * different field names) and rendered several fields the backend never sent.
 * These types are the single description of what actually comes back; anything
 * not declared here does not exist.
 */

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * Ordered by how much the reader can act on them, which is the order the
 * filter offers them in.
 *
 * `secret` and `metric` are split out of `security` and `quality`. A committed
 * credential is an incident rather than a weakness; a metric is a measurement
 * rather than a defect — "this file is 1,050 lines" has no fix, only a
 * judgement, and mixed into the list it buries real work under volume.
 */
export const CATEGORIES = [
  "secret",
  "security",
  "dependencies",
  "correctness",
  "performance",
  "configuration",
  "testing",
  "quality",
  "metric",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Measurements. Shown, never scored, and not in the default view. */
export const METRIC_CATEGORIES: readonly Category[] = ["metric"];

export type Confidence = "high" | "medium" | "low";
export type SourceKind = "repository" | "upload";
export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Finding {
  id: string;
  /**
   * Identity across reports, so the same problem is recognisable in a later
   * run. Empty on reports produced before diffing existed.
   */
  fingerprint: string;
  rule_id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  confidence: Confidence;
  file: string | null;
  line: number | null;
  end_line: number | null;
  snippet: string | null;
  /** First line of `snippet`, for correct gutter numbering. */
  snippet_start_line: number | null;
  remediation: string | null;
  references: string[];
  /**
   * What to fix first: severity x confidence x how actionable the category is,
   * 0-100, computed on the server so every consumer ranks findings the same
   * way. 0 on reports written before prioritisation existed, which sorts them
   * last rather than pretending to know.
   */
  priority: number;
  /**
   * Accepted by the report's owner. Set when the report is read, never stored,
   * so restoring a finding takes effect without re-analysing.
   */
  suppressed: boolean;
  suppression_reason: string | null;
}

export interface LanguageStat {
  language: string;
  files: number;
  lines: number;
  share: number;
}

export interface DependencyInfo {
  name: string;
  version_spec: string;
  resolved_version: string | null;
  ecosystem: string;
  is_dev: boolean;
  vulnerabilities: string[];
}

export interface ProjectInfo {
  name: string | null;
  description: string | null;
  languages: LanguageStat[];
  frameworks: string[];
  package_managers: string[];
  entry_points: string[];
  total_files: number;
  analysed_files: number;
  total_lines: number;
  has_tests: boolean;
  has_ci: boolean;
  has_lockfile: boolean;
}

export interface CategoryScore {
  category: Category;
  score: number;
  findings: number;
  weight: number;
}

export interface Score {
  value: number;
  grade: Grade;
  categories: CategoryScore[];
  summary: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface SourceInfo {
  kind: SourceKind;
  repository: string | null;
  ref: string | null;
  commit: string | null;
  url: string | null;
  filename: string | null;
}

export interface IngestStats {
  files_extracted: number;
  files_analysed: number;
  bytes_extracted: number;
  compression_ratio: number;
  skipped_directories: string[];
  /** Unsafe archive entries by reason, e.g. `{ symlink: 2 }`. */
  rejected_entries: Record<string, number>;
}

export interface ReportSummary {
  id: string;
  created_at: string;
  source: SourceInfo;
  /** As analysed. Use `displayScore()` unless you specifically want this one. */
  score: number;
  /** `score` with accepted findings excluded, or null when none are. */
  effective_score: number | null;
  suppressed_count: number;
  grade: Grade;
  severity_counts: SeverityCounts;
  total_findings: number;
  duration_seconds: number;
}

export interface ChurnEntry {
  file: string;
  /** Commits touching this file inside `window_days`. */
  changes: number;
  findings: number;
  top_severity: Severity;
}

/**
 * Commit history, read from the GitHub API rather than the snapshot — the
 * analyser works from a tarball, which has no `.git`.
 */
export interface RepositoryActivity {
  window_days: number;
  /** Oldest week first. Empty when GitHub had not finished computing it. */
  weekly_commits: number[];
  churn: ChurnEntry[];
  /**
   * Files carrying a finding. Larger than `churn.length` when the per-file
   * lookup was capped — the cap is a designed bound, not a failure, so it does
   * not set `partial`.
   */
  files_with_findings: number;
  partial: boolean;
  /** Why it is partial — shown verbatim, never invented. */
  unavailable_reason: string | null;
}

/** A repository the signed-in user can reach, for the picker. */
export interface RepositoryOption {
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  default_branch: string | null;
  html_url: string | null;
  pushed_at: string | null;
}

export interface SourceFileEntry {
  path: string;
  size: number;
  language: string | null;
  analysable: boolean;
  /** Findings anchored here, so the tree can show where the problems are. */
  findings: number;
}

export interface SourceTree {
  files: SourceFileEntry[];
  truncated: boolean;
}

export interface SourceFile {
  path: string;
  language: string | null;
  content: string;
  lines: number;
  /** Findings in this file, for the gutter. Delivered with the code so the
   *  markers land on first paint rather than after a second round-trip. */
  findings: Finding[];
}

/** A finding present in the previous report and gone from this one. */
export interface ResolvedFinding {
  fingerprint: string;
  rule_id: string;
  title: string;
  file: string | null;
  severity: Severity;
}

/** What changed since the previous analysis of the same repository. */
export interface FindingDelta {
  previous_report_id: string;
  previous_created_at: string;
  /** Fingerprints of findings in this report that were not in the last one. */
  new: string[];
  resolved: ResolvedFinding[];
  unchanged: number;
  /**
   * Rules that ran this time but not last time. Their findings are all
   * technically new, which misleads without saying so — the code may not have
   * changed at all.
   */
  new_rules: string[];
}

export interface Report {
  id: string;
  created_at: string;
  duration_seconds: number;
  source: SourceInfo;
  project: ProjectInfo;
  score: Score;
  severity_counts: SeverityCounts;
  findings: Finding[];
  dependencies: DependencyInfo[];
  ingest: IngestStats;
  /** Absent for uploads, and when history could not be read at all. */
  activity: RepositoryActivity | null;
  truncated: boolean;
  /** Every rule that ran, including those that found nothing. */
  rule_ids: string[];
  /** How many findings the owner has accepted. Always shown, never silent. */
  suppressed_count: number;
  /**
   * Whether *this viewer* may accept findings here. Unlike everything else on
   * the report this varies by caller, so the UI can omit a control that would
   * only ever be refused.
   */
  can_suppress: boolean;
  /**
   * The score recomputed with suppressed findings excluded. Null when nothing
   * is suppressed. `score` is always what the analysis produced.
   */
  effective_score: Score | null;
  /**
   * Absent on a first analysis, on uploads, and when no comparable earlier
   * report is visible to this owner.
   */
  delta: FindingDelta | null;
}

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

export type AIState = "unconfigured" | "ready" | "cooling_down";

export interface AIHealth {
  configured: boolean;
  available: boolean;
  state: AIState;
  model: string | null;
  /** Why AI is unavailable — shown to the user verbatim, never invented. */
  reason: string | null;
  retry_after_seconds: number | null;
}

export interface DependencyHealth {
  configured: boolean;
  available: boolean;
  detail: string | null;
}

export interface AuthStatus {
  configured: boolean;
  /** Why sign-in is unavailable — shown verbatim, never invented. */
  reason: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  environment: string;
  timestamp: string;
  ai: AIHealth;
  database: DependencyHealth;
  auth: AuthStatus;
}

/* -------------------------------------------------------------------------- */
/* Analysis progress                                                           */
/* -------------------------------------------------------------------------- */

export const ANALYSIS_STAGES = [
  "queued",
  "fetching",
  "extracting",
  "indexing",
  "analysing",
  "scoring",
  "enriching",
  "persisting",
  "done",
  "failed",
] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export interface ProgressEvent {
  stage: AnalysisStage;
  message: string;
  completed: number;
  total: number;
  report_id: string | null;
  error: string | null;
}

export interface JobStarted {
  job_id: string;
}

/** Structured error payload returned by every backend failure. */
export interface ApiErrorBody {
  code: string;
  message: string;
  detail?: string;
}

export interface PullRequestCommentResult {
  comment_url: string;
  pull_request_url: string;
  /** The commit the comment describes, so staleness is checkable. */
  head_sha: string;
}
