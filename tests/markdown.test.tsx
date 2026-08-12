import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Markdown } from "@/components/markdown/markdown";
import { languageLabel, normaliseLanguage } from "@/lib/highlighter";
import { MARKDOWN_FIXTURES } from "@/lib/markdown-fixtures";

// Shiki is loaded lazily and is irrelevant to structure; stub it so tests stay
// fast and deterministic. The unhighlighted fallback renders the same text.
vi.mock("@/lib/highlighter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/highlighter")>(
    "@/lib/highlighter",
  );
  return { ...actual, highlight: vi.fn().mockRejectedValue(new Error("stubbed")) };
});

describe("Markdown — structure", () => {
  it("renders headings as headings, never as literal hashes", () => {
    render(<Markdown>{"# Explanation\n\n## What this does"}</Markdown>);

    expect(screen.getByRole("heading", { name: "Explanation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What this does" })).toBeInTheDocument();
    // The exact regression being fixed: "# Explanation" must not appear as text.
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("# Explanation");
  });

  it("demotes model h1 below the page heading while keeping hierarchy", () => {
    const { container } = render(<Markdown># Top</Markdown>);
    // The page owns <h1>; model output starts at <h2>.
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("renders bold and italic as elements", () => {
    const { container } = render(<Markdown>**bold** and *italic*</Markdown>);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(document.body.textContent).not.toContain("**");
  });

  it("renders inline code without backticks", () => {
    const { container } = render(<Markdown>Use `ArrayList` here.</Markdown>);
    const code = container.querySelector("code");
    expect(code).toHaveTextContent("ArrayList");
    expect(document.body.textContent).not.toContain("`");
  });

  it("renders unordered and ordered lists", () => {
    const { container } = render(
      <Markdown>{"- one\n- two\n\n1. first\n2. second"}</Markdown>,
    );
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders nested lists", () => {
    const { container } = render(
      <Markdown>{"- outer\n  - inner\n    - deeper"}</Markdown>,
    );
    expect(container.querySelector("ul ul ul")).not.toBeNull();
  });

  it("renders GFM tables with header cells", () => {
    render(
      <Markdown>{"| Feature | Status |\n|---|---|\n| Login | Done |"}</Markdown>,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Feature" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Login" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("|---|");
  });

  it("renders task lists as checkboxes", () => {
    render(<Markdown>{"- [x] done\n- [ ] todo"}</Markdown>);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(document.body.textContent).not.toContain("[x]");
  });

  it("renders a blockquote", () => {
    const { container } = render(<Markdown>{"> Important"}</Markdown>);
    expect(container.querySelector("blockquote")).toHaveTextContent("Important");
    expect(document.body.textContent).not.toContain(">");
  });

  it("renders a horizontal rule instead of dashes", () => {
    const { container } = render(<Markdown>{"a\n\n---\n\nb"}</Markdown>);
    expect(container.querySelector("hr")).not.toBeNull();
    expect(document.body.textContent).not.toContain("---");
  });

  it("renders strikethrough via GFM", () => {
    const { container } = render(<Markdown>~~gone~~</Markdown>);
    expect(container.querySelector("del")).toHaveTextContent("gone");
  });
});

describe("Markdown — links", () => {
  it("renders external links safely in a new tab", () => {
    render(<Markdown>[GitHub](https://github.com)</Markdown>);
    const link = screen.getByRole("link", { name: /GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(document.body.textContent).not.toContain("](");
  });

  it("keeps internal links in the same tab", () => {
    render(<Markdown>[docs](/docs)</Markdown>);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).not.toHaveAttribute("target");
  });
});

describe("Markdown — code blocks", () => {
  it("renders a fenced block with its language label and no backticks", async () => {
    render(<Markdown>{"```java\npublic class A {}\n```"}</Markdown>);

    expect(await screen.findByText("Java")).toBeInTheDocument();
    expect(screen.getByText(/public class A/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("```");
    expect(document.body.textContent).not.toContain("language-java");
  });

  it("copies only the code, and confirms it", async () => {
    // userEvent.setup() installs its own clipboard stub, so ours must be
    // applied afterwards or it gets replaced.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<Markdown>{"```python\nprint('hi')\n```"}</Markdown>);

    await user.click(await screen.findByRole("button", { name: /copy python code/i }));

    expect(writeText).toHaveBeenCalledWith("print('hi')");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("falls back to a generic block when no language is given", async () => {
    render(<Markdown>{"```\nplain text\n```"}</Markdown>);
    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });

  it("keeps inline code out of the block renderer", () => {
    render(<Markdown>inline `x` only</Markdown>);
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });
});

describe("Markdown — security", () => {
  it("does not execute or emit script tags", () => {
    const { container } = render(
      <Markdown>{"<script>window.__pwned = true</script>"}</Markdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it("strips event handlers from raw HTML", () => {
    const { container } = render(
      <Markdown>{`<img src=x onerror="alert('xss')">`}</Markdown>,
    );
    const img = container.querySelector("img");
    // Raw HTML is not parsed at all, so no element should exist.
    expect(img).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("does not produce javascript: links", () => {
    const { container } = render(
      <Markdown>{"[click](javascript:alert(1))"}</Markdown>,
    );
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(href.toLowerCase()).not.toContain("javascript:");
  });
});

describe("Markdown — resilience", () => {
  it("renders every fixture without throwing", () => {
    for (const fixture of MARKDOWN_FIXTURES) {
      expect(() => render(<Markdown>{fixture.source}</Markdown>)).not.toThrow();
    }
  });

  it("degrades gracefully on malformed markdown", () => {
    const malformed = MARKDOWN_FIXTURES.find((f) => f.id === "malformed")!;
    const { container } = render(<Markdown>{malformed.source}</Markdown>);
    // An unterminated fence still yields a heading and readable content.
    expect(container.querySelector("h4")).not.toBeNull();
    expect(container.textContent).toContain("const x = 1;");
  });

  it("handles an empty response without crashing", () => {
    const { container } = render(<Markdown>{""}</Markdown>);
    expect(container.firstChild).not.toBeNull();
  });
});

describe("language normalisation", () => {
  it("maps common aliases Gemini emits", () => {
    expect(normaliseLanguage("js")).toBe("javascript");
    expect(normaliseLanguage("PY")).toBe("python");
    expect(normaliseLanguage("language-typescript")).toBe("typescript");
    expect(normaliseLanguage("c++")).toBe("cpp");
    expect(normaliseLanguage("sh")).toBe("bash");
  });

  it("falls back to text for unknown or missing languages", () => {
    expect(normaliseLanguage(undefined)).toBe("text");
    expect(normaliseLanguage("brainfuck")).toBe("text");
  });

  it("produces human labels, not class names", () => {
    expect(languageLabel("javascript")).toBe("JavaScript");
    expect(languageLabel("csharp")).toBe("C#");
    expect(languageLabel("text")).toBe("Text");
  });
});
