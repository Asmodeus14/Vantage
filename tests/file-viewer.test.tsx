import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FileSource } from "@/components/report/file-source";
import { FileTree } from "@/components/report/file-tree";
import type { Finding, SourceFile, SourceFileEntry } from "@/lib/types";

function entry(path: string, findings = 0): SourceFileEntry {
  return { path, size: 100, language: "javascript", analysable: true, findings };
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    fingerprint: "fp1",
    rule_id: "test/rule",
    title: "Test finding",
    description: "d",
    category: "quality",
    severity: "medium",
    confidence: "high",
    file: "src/index.js",
    line: 2,
    end_line: 2,
    snippet: null,
    snippet_start_line: null,
    remediation: null,
    references: [],
    suppressed: false,
    suppression_reason: null,
    ...overrides,
  };
}

function sourceFile(overrides: Partial<SourceFile> = {}): SourceFile {
  return {
    path: "src/index.js",
    language: "javascript",
    content: "const a = 1;\nconst b = 2;\nconst c = 3;",
    lines: 3,
    findings: [],
    ...overrides,
  };
}

describe("FileTree", () => {
  const files = [
    entry("src/index.js", 2),
    entry("src/util/deep.js"),
    entry("README.md"),
  ];

  it("builds folders from flat paths", () => {
    // The API returns a flat list because that is what both source providers
    // can produce cheaply; the tree is a rendering concern.
    render(
      <FileTree files={files} reportId="r1" activePath={null} truncated={false} />,
    );
    expect(screen.getByRole("button", { name: /src/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /README\.md/ })).toBeInTheDocument();
  });

  it("bubbles finding counts up to collapsed folders", async () => {
    // Otherwise a collapsed folder gives no reason to open it, and the counts
    // are the only thing making this more useful than the repo on GitHub.
    render(
      <FileTree
        files={[entry("deep/nested/bad.js", 3)]}
        reportId="r1"
        activePath={null}
        truncated={false}
      />,
    );
    const folder = screen.getByRole("button", { name: /deep/ });
    expect(within(folder).getByText("3")).toBeInTheDocument();
  });

  it("links to the file route with each segment encoded", () => {
    // A folder with findings starts open, so this one is reachable without a
    // click — see the collapsing test below.
    render(
      <FileTree
        files={[entry("src dir/a b.js", 1)]}
        reportId="r 1"
        activePath={null}
        truncated={false}
      />,
    );
    // The slashes must survive as path separators while the segments are
    // encoded — encoding the whole path would collapse it into one segment.
    expect(screen.getByRole("link", { name: /a b\.js/ })).toHaveAttribute(
      "href",
      "/r/r%201/f/src%20dir/a%20b.js",
    );
  });

  it("opens folders that contain findings and leaves quiet ones closed", () => {
    // Opening a viewer to a fully collapsed tree and hunting for the file you
    // came to read is the wrong first impression.
    render(
      <FileTree
        files={[entry("noisy/bad.js", 1), entry("quiet/fine.js")]}
        reportId="r1"
        activePath={null}
        truncated={false}
      />,
    );
    expect(screen.getByRole("link", { name: /bad\.js/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /fine\.js/ })).not.toBeInTheDocument();
  });

  it("marks the file being viewed", () => {
    render(
      <FileTree
        files={files}
        reportId="r1"
        activePath="src/index.js"
        truncated={false}
      />,
    );
    expect(screen.getByRole("link", { name: /index\.js/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("filters and keeps matches visible without needing folders opened", async () => {
    const user = userEvent.setup();
    render(
      <FileTree
        files={[entry("src/util/deep.js"), entry("README.md")]}
        reportId="r1"
        activePath={null}
        truncated={false}
      />,
    );

    await user.type(screen.getByLabelText("Filter files"), "deep");
    expect(screen.getByRole("link", { name: /deep\.js/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /README/ })).not.toBeInTheDocument();
  });

  it("says when the listing was capped rather than implying it is complete", () => {
    render(<FileTree files={files} reportId="r1" activePath={null} truncated />);
    expect(screen.getByText(/first 5,000 files/i)).toBeInTheDocument();
  });
});

describe("FileSource", () => {
  it("numbers every line", () => {
    render(<FileSource file={sourceFile()} />);
    for (const number of ["1", "2", "3"]) {
      expect(screen.getByText(number)).toBeInTheDocument();
    }
  });

  it("marks the lines that carry findings", () => {
    const { container } = render(
      <FileSource file={sourceFile({ findings: [finding({ line: 2 })] })} />,
    );
    // The gutter mark is the whole reason this view exists rather than linking
    // out to GitHub.
    expect(container.querySelector("#L2")?.className).toContain("bg-medium-bg");
    expect(container.querySelector("#L1")?.className).not.toContain("bg-medium-bg");
  });

  it("lists the findings under the file, because a gutter mark cannot explain itself", () => {
    render(
      <FileSource
        file={sourceFile({
          findings: [finding({ line: 2, title: "Something specific" })],
        })}
      />,
    );
    expect(screen.getByText("1 in this file")).toBeInTheDocument();
    expect(screen.getByText("Something specific")).toBeInTheDocument();
  });

  it("shows the most severe finding's colour when a line has several", () => {
    const { container } = render(
      <FileSource
        file={sourceFile({
          findings: [
            finding({ id: "a", line: 2, severity: "low" }),
            finding({ id: "b", line: 2, severity: "critical" }),
          ],
        })}
      />,
    );
    expect(container.querySelector("#L2")?.className).toContain("bg-critical-bg");
  });

  it("says nothing about findings when the file is clean", () => {
    render(<FileSource file={sourceFile()} />);
    expect(screen.queryByText(/in this file/)).not.toBeInTheDocument();
  });
});
