import type { Metadata } from "next";

import { Markdown } from "@/components/markdown/markdown";
import { LONG_RESPONSE, MARKDOWN_FIXTURES } from "@/lib/markdown-fixtures";

export const metadata: Metadata = {
  title: "Markdown rendering",
  robots: { index: false, follow: false },
};

/**
 * Visual QA surface for the markdown renderer.
 *
 * Every fixture here is also asserted in tests/markdown.test.tsx; this page
 * exists so the *rendering* can be inspected, which unit tests cannot do.
 */
export default function MarkdownDevPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-fg">
          Markdown rendering
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Representative model responses, rendered through the same pipeline the
          product uses. Not linked from the app.
        </p>
      </header>

      <div className="space-y-10">
        {MARKDOWN_FIXTURES.map((fixture) => (
          <section key={fixture.id} aria-labelledby={`fixture-${fixture.id}`}>
            <h2
              id={`fixture-${fixture.id}`}
              className="mb-3 border-b border-border pb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle"
            >
              {fixture.name}
            </h2>
            <Markdown>{fixture.source}</Markdown>
          </section>
        ))}

        <section aria-labelledby="fixture-long">
          <h2
            id="fixture-long"
            className="mb-3 border-b border-border pb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle"
          >
            Long mixed response
          </h2>
          <Markdown>{LONG_RESPONSE}</Markdown>
        </section>
      </div>
    </div>
  );
}
