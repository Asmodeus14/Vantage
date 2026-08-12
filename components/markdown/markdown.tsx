"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Check, ExternalLink } from "lucide-react";

import { CodeBlock } from "@/components/markdown/code-block";
import { cn } from "@/lib/utils";
import type { Element, ElementContent, Root } from "hast";

/**
 * Markdown renderer for model output.
 *
 * Security posture: react-markdown does not parse raw HTML unless `rehype-raw`
 * is added, which it deliberately is not — so markup in the source is escaped
 * as text rather than executed. `rehype-sanitize` is layered on top as defence
 * in depth, in case a future plugin reintroduces HTML parsing.
 *
 * Everything here goes through the real parser. No regex rewriting, no
 * splitting on newlines, no stripping of `#`.
 */

/**
 * GitHub's schema, plus the few things GFM legitimately produces:
 * language classes on code, and disabled checkboxes for task lists.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./]],
    input: [
      ["type", "checkbox"],
      "checked",
      "disabled",
    ],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "align"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "input"],
} as typeof defaultSchema;

/** Collect the text content of a hast node tree. */
function textOf(nodes: ElementContent[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "element") return textOf(node.children);
      return "";
    })
    .join("");
}

function isExternal(href: string | undefined): boolean {
  return Boolean(href && /^https?:\/\//i.test(href));
}

const components: Components = {
  /*
   * Headings. Model output starts at `#`, but it is embedded inside a page
   * whose own <h1> is the report title — so these render one level down
   * semantically while keeping their visual hierarchy.
   */
  /*
   * Scale is deliberately spread — an earlier version ran 15/14/13px against
   * 13.5px body text, so headings were indistinguishable from paragraphs.
   * Space above a heading is roughly triple the space below it, which is what
   * binds a heading to the text it introduces rather than the text above.
   */
  h1: ({ children }) => (
    <h2 className="mt-8 mb-2 scroll-m-20 text-[17px] font-semibold leading-snug tracking-[-0.012em] text-fg first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-7 mb-2 scroll-m-20 text-[15px] font-semibold leading-snug tracking-[-0.008em] text-fg first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-6 mb-1.5 scroll-m-20 text-[13.5px] font-semibold leading-snug text-fg first:mt-0">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-5 mb-1.5 text-[13px] font-semibold leading-snug text-fg-muted first:mt-0">
      {children}
    </h5>
  ),
  h5: ({ children }) => (
    <h6 className="mt-4 mb-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-fg-subtle first:mt-0">
      {children}
    </h6>
  ),
  h6: ({ children }) => (
    <h6 className="mt-4 mb-1 text-[12px] font-medium uppercase tracking-[0.05em] text-fg-subtle first:mt-0">
      {children}
    </h6>
  ),

  p: ({ children }) => (
    <p className="my-2.5 leading-[1.65] text-fg first:mt-0 last:mb-0">{children}</p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-fg">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-fg-subtle line-through">{children}</del>
  ),

  ul: ({ children }) => (
    <ul className="my-2.5 ml-[1.1rem] list-outside list-disc space-y-1.5 marker:text-fg-subtle">
      {children}
    </ul>
  ),
  // `start` must be forwarded. A fenced code block terminates a list, so the
  // steps after it begin a new <ol start="2">; dropping the attribute made
  // every step render as "1.".
  ol: ({ children, start }) => (
    <ol
      {...(typeof start === "number" ? { start } : {})}
      className="my-2.5 ml-[1.2rem] list-outside list-decimal space-y-1.5 marker:tabular-nums marker:text-fg-subtle"
    >
      {children}
    </ol>
  ),
  li: ({ children, className }) => {
    // GFM marks task-list items; those carry their own checkbox and should not
    // also show a bullet.
    const isTask = typeof className === "string" && className.includes("task-list-item");
    return (
      <li
        className={cn(
          "leading-[1.6] text-fg",
          // Nested lists sit tighter than top-level ones.
          "[&>ul]:my-1.5 [&>ol]:my-1.5",
          isTask && "list-none -ml-[1.1rem] flex items-start gap-2",
        )}
      >
        {children}
      </li>
    );
  },
  // A native disabled checkbox is greyed out by the browser, which ignores
  // `accent-color` — so a completed step looked deactivated rather than done.
  // The box is drawn here instead, keeping the real input for semantics.
  input: ({ checked, type }) =>
    type === "checkbox" ? (
      <span className="relative mt-[0.28rem] inline-flex shrink-0">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          readOnly
          disabled
          className="peer size-3.5 appearance-none rounded-[3px] border border-border-strong bg-canvas checked:border-accent checked:bg-accent"
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto size-2.5 text-fg-on-accent opacity-0 peer-checked:opacity-100"
          aria-hidden
        />
      </span>
    ) : null,

  a: ({ href, children }) => {
    const external = isExternal(href);
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex items-baseline gap-0.5 rounded-sm font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors duration-(--duration-fast) hover:decoration-accent"
      >
        {children}
        {external && (
          <ExternalLink className="size-2.5 shrink-0 translate-y-[1px]" aria-hidden />
        )}
      </a>
    );
  },

  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong pl-3.5 text-fg-muted [&>p]:my-1.5">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-6 border-t border-border" />,

  /*
   * Fenced code. Read straight off the hast node rather than the rendered
   * children, so the language class and the exact source text are exact.
   */
  pre: ({ node, children }) => {
    const codeNode = (node as Element | undefined)?.children?.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    );

    if (codeNode) {
      const classes = codeNode.properties?.className;
      const className = Array.isArray(classes) ? classes.join(" ") : String(classes ?? "");
      const language = /language-([\w+#.-]+)/.exec(className)?.[1];
      const code = textOf(codeNode.children).replace(/\n$/, "");
      return <CodeBlock code={code} language={language} />;
    }

    return <pre className="scrollbar-thin overflow-x-auto">{children}</pre>;
  },

  /*
   * Only inline code reaches here — fenced blocks are consumed by `pre`.
   *
   * No border, minimal padding. These answers are dense with identifiers, and
   * a bordered chip per identifier turned paragraphs into a striped surface
   * that could not be read across. A flat tint separates code from prose
   * without competing with it.
   */
  code: ({ children }) => (
    <code className="rounded-[3px] bg-code-inline px-[0.32em] py-[0.05em] font-mono text-[0.86em] text-fg">
      {children}
    </code>
  ),

  table: ({ children }) => (
    <div className="scrollbar-thin my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-raised">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-fg"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-fg-muted">
      {children}
    </td>
  ),

  // Model output should not be embedding images; render the alt text instead
  // of an unreachable remote asset.
  img: ({ alt }) => (
    <span className="text-xs text-fg-subtle">{alt ? `[image: ${alt}]` : "[image]"}</span>
  ),
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[13.5px] text-fg",
        // Prose keeps a comfortable measure. Capping every block and then
        // exempting the two that need room is more robust than listing the
        // prose elements — headings used to be missed and ran the full width.
        // Code and tables are exempt because wrapping them costs more than it
        // gains; the table wrapper is a <div>, the code block a <figure>.
        "[&>*]:max-w-[68ch] [&>figure]:max-w-none [&>div]:max-w-none [&>pre]:max-w-none",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export type { Root };
