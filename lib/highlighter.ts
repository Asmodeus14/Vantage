/**
 * Lazy Shiki highlighter.
 *
 * Loaded on first use via dynamic import, so the grammar bundle never lands in
 * the initial page payload — it only arrives when a response actually contains
 * a fenced code block.
 *
 * Both themes are emitted at once with `defaultColor: false`, which makes Shiki
 * write `--shiki-light` / `--shiki-dark` custom properties per token instead of
 * hardcoded colours. Theme switching is then pure CSS (see globals.css) with no
 * re-highlighting and no flash.
 */

import type { BundledLanguage, Highlighter } from "shiki";

/** Languages we load up front. Anything else falls back to plain text. */
const LANGUAGES = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "java",
  "json",
  "bash",
  "shell",
  "css",
  "scss",
  "html",
  "sql",
  "go",
  "rust",
  "yaml",
  "toml",
  "markdown",
  "diff",
  "php",
  "ruby",
  "c",
  "cpp",
  "csharp",
  "kotlin",
  "swift",
  "dockerfile",
  "xml",
] as const satisfies readonly BundledLanguage[];

const SUPPORTED = new Set<string>(LANGUAGES);

/**
 * Common aliases Gemini emits. Anything unmapped and unsupported renders as
 * plain text rather than failing.
 */
const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  zsh: "bash",
  console: "bash",
  shellsession: "bash",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  golang: "go",
  yml: "yaml",
  kt: "kotlin",
  md: "markdown",
  htm: "html",
  jsonc: "json",
  json5: "json",
  plaintext: "text",
  txt: "text",
  text: "text",
};

export function normaliseLanguage(raw: string | undefined | null): string {
  if (!raw) return "text";
  const cleaned = raw.trim().toLowerCase().replace(/^language-/, "");
  const mapped = ALIASES[cleaned] ?? cleaned;
  return SUPPORTED.has(mapped) ? mapped : "text";
}

/** Human-facing label, e.g. "TypeScript" rather than "language-typescript". */
const DISPLAY_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  python: "Python",
  java: "Java",
  json: "JSON",
  bash: "Shell",
  shell: "Shell",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  yaml: "YAML",
  toml: "TOML",
  markdown: "Markdown",
  diff: "Diff",
  php: "PHP",
  ruby: "Ruby",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  kotlin: "Kotlin",
  swift: "Swift",
  dockerfile: "Dockerfile",
  xml: "XML",
  text: "Text",
};

export function languageLabel(language: string): string {
  return DISPLAY_NAMES[language] ?? language.toUpperCase();
}

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: [...LANGUAGES],
      }),
    );
  }
  return highlighterPromise;
}

/**
 * Highlight to HTML.
 *
 * Shiki tokenises plain text and escapes every value it emits, so the result
 * contains no markup originating from the input. That is what makes it safe to
 * insert directly; we never pass model-authored HTML through this path.
 */
export async function highlight(code: string, language: string): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: language === "text" ? "text" : (language as BundledLanguage),
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}
