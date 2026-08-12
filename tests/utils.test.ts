import { describe, expect, it } from "vitest";

import { compareSeverity, scoreColour } from "@/lib/severity";
import { formatBytes, formatDuration, pluralise, repoShortName } from "@/lib/utils";
import { SEVERITIES } from "@/lib/types";

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 250)).toBe("250 MB");
  });
});

describe("formatDuration", () => {
  it("uses milliseconds below a second", () => {
    expect(formatDuration(0.25)).toBe("250ms");
  });
  it("uses seconds, then minutes", () => {
    expect(formatDuration(3.4)).toBe("3.4s");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});

describe("repoShortName", () => {
  it("takes the repository half of owner/name", () => {
    expect(repoShortName("facebook/react")).toBe("react");
  });
  it("tolerates missing values", () => {
    expect(repoShortName(null)).toBe("");
    expect(repoShortName(undefined)).toBe("");
  });
});

describe("pluralise", () => {
  it("handles regular and irregular plurals", () => {
    expect(pluralise(1, "finding")).toBe("finding");
    expect(pluralise(2, "finding")).toBe("findings");
    expect(pluralise(2, "dependency", "dependencies")).toBe("dependencies");
  });
});

describe("compareSeverity", () => {
  it("sorts most urgent first", () => {
    const shuffled = ["low", "critical", "info", "high", "medium"] as const;
    expect([...shuffled].sort(compareSeverity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "info",
    ]);
  });

  it("covers every severity the API can return", () => {
    for (const severity of SEVERITIES) {
      expect(() => compareSeverity(severity, "low")).not.toThrow();
    }
  });
});

describe("scoreColour", () => {
  it("degrades from success to critical", () => {
    expect(scoreColour(95)).toContain("success");
    expect(scoreColour(85)).toContain("low");
    expect(scoreColour(75)).toContain("medium");
    expect(scoreColour(65)).toContain("high");
    expect(scoreColour(20)).toContain("critical");
  });
});
