/**
 * Representative model responses, used by the markdown unit tests and by the
 * /dev/markdown QA page. Each is shaped like something Gemini actually returns.
 */

export interface MarkdownFixture {
  id: string;
  name: string;
  source: string;
}

export const MARKDOWN_FIXTURES: MarkdownFixture[] = [
  {
    id: "paragraph",
    name: "Simple paragraph",
    source:
      "The loop counter is declared with `var`, which is function-scoped rather than block-scoped. In this function it is never read after the loop, so the practical impact is limited.",
  },
  {
    id: "headings",
    name: "Headings + paragraphs",
    source: `# Explanation

## What this function does

It sums the \`price\` field across every item in the array.

### Step by step

The accumulator starts at zero and is incremented once per element.

#### A deeper heading

Rarely used, but it must not fall back to body text.`,
  },
  {
    id: "lists",
    name: "Nested lists",
    source: `Checks to run:

- Verify the input array is never \`null\`
  - Add a guard clause at the top
  - Or use a default parameter
- Confirm every element has a numeric \`price\`
  1. Log a sample payload
  2. Add a runtime assertion
     - Prefer a schema validator
- Re-run the test suite`,
  },
  {
    id: "ordered",
    name: "Ordered list",
    source: `1. Pin the dependency to a patched release.
2. Run \`npm install\` to refresh the lockfile.
3. Re-run the analysis to confirm the advisory clears.`,
  },
  {
    id: "java",
    name: "Java code block",
    source: `Here is a minimal reproduction:

\`\`\`java
public class Main {
    public static void main(String[] args) {
        List<Item> items = new ArrayList<>();
        items.add(new Item("book", 12.99));
        System.out.println(total(items));
    }

    static double total(List<Item> items) {
        return items.stream().mapToDouble(Item::price).sum();
    }
}
\`\`\``,
  },
  {
    id: "javascript",
    name: "JavaScript code block",
    source: `\`\`\`javascript
export function calculateTotal(items = []) {
  return items.reduce((sum, item) => sum + (item.price ?? 0), 0);
}
\`\`\``,
  },
  {
    id: "python",
    name: "Python code block",
    source: `\`\`\`python
def total(items: list[Item]) -> float:
    """Sum the price of every item."""
    return sum(item.price for item in items)
\`\`\``,
  },
  {
    id: "json",
    name: "JSON code block",
    source: `\`\`\`json
{
  "name": "vantage",
  "dependencies": {
    "react": "^19.1.1"
  }
}
\`\`\``,
  },
  {
    id: "shell",
    name: "Shell commands",
    source: `\`\`\`bash
npm install postcss@latest
npm audit fix --force
\`\`\``,
  },
  {
    id: "multi-code",
    name: "Multiple code blocks + prose",
    source: `Replace the loop:

\`\`\`javascript
for (var i = 0; i < items.length; i++) {}
\`\`\`

with a scoped declaration:

\`\`\`javascript
for (let i = 0; i < items.length; i += 1) {}
\`\`\`

Then run the tests.`,
  },
  {
    id: "table",
    name: "Table",
    source: `| Package | Installed | Patched | Severity |
|---|---|---|---|
| postcss | 8.5.6 | 8.5.7 | Moderate |
| vite | 7.1.11 | 7.1.12 | High |
| lodash | 4.17.15 | 4.17.21 | Critical |`,
  },
  {
    id: "blockquote",
    name: "Blockquote + horizontal rule",
    source: `> This advisory only affects the development server, not production builds.

---

Upgrade at your convenience.`,
  },
  {
    id: "links",
    name: "Links + inline code",
    source:
      "See the [OSV advisory](https://osv.dev/vulnerability/GHSA-1234) for the full range, or run `npm audit` locally. Relative links like [the docs](/docs) should not open a new tab.",
  },
  {
    id: "checklist",
    name: "Task list",
    source: `- [x] Upgrade the direct dependency
- [x] Refresh the lockfile
- [ ] Re-run the analysis
- [ ] Confirm the advisory clears`,
  },
  {
    id: "emphasis",
    name: "Emphasis + strikethrough",
    source:
      "**Important:** this is *not* a production issue. ~~Previously believed critical.~~ Treat it as `low` severity.",
  },
  {
    id: "long-lines",
    name: "Long unbroken lines",
    source: `A very long single line of prose that keeps going well past any comfortable measure to prove that wrapping behaves and the layout does not blow out horizontally when the model decides to write one enormous sentence without any punctuation to break it up at all.

\`\`\`text
https://example.com/a/very/long/url/that/should/scroll/horizontally/rather/than/wrap/and/break/the/layout?with=query&parameters=attached&more=values
\`\`\``,
  },
  {
    id: "malformed",
    name: "Malformed markdown",
    source: `### Unclosed code fence below

\`\`\`javascript
const x = 1;

**Unclosed bold and a stray | pipe | character

| broken | table
|---|`,
  },
  {
    id: "html-injection",
    name: "HTML / injection attempt",
    source: `Normal text, then raw HTML:

<script>window.__pwned = true</script>

<img src=x onerror="alert('xss')">

<div style="color:red">Styled div</div>

And an inline event handler: <a href="javascript:alert(1)">click me</a>`,
  },
];

export const LONG_RESPONSE: string = `# Dependency advisory summary

The lockfile resolves **postcss** to \`8.5.6\`, which is covered by four
advisories. None are reachable from production code in this project, but the
build toolchain does execute the affected code path.

## Why this matters here

PostCSS is invoked by Tailwind during \`next build\`. A malicious stylesheet
could therefore influence the build, though in practice all stylesheets in this
repository are first-party.

### Affected range

| Advisory | Range | Fixed in |
|---|---|---|
| GHSA-7fh5-64p2-3v2j | \`< 8.4.31\` | 8.4.31 |
| GHSA-566m-qj78-rww5 | \`< 8.2.13\` | 8.2.13 |

## Recommended fix

1. Bump the direct dependency:

\`\`\`bash
npm install postcss@^8.5.7
\`\`\`

2. Verify the transitive tree no longer resolves the old version:

\`\`\`bash
npm ls postcss
\`\`\`

3. Re-run the analysis.

> If the build starts failing after the upgrade, check that \`autoprefixer\`
> is on a compatible major.

---

### What to check afterwards

- [ ] \`npm ls postcss\` reports a single resolved version
- [ ] \`next build\` completes
- [ ] The advisory no longer appears in a fresh report

For the full ranges, see the [OSV database](https://osv.dev).`;
