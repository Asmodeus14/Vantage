import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiActions } from "@/components/report/ai-actions";
import type { Finding } from "@/lib/types";

const finding: Finding = {
  id: "f1",
  fingerprint: "fp-f1",
  rule_id: "test/rule",
  title: "Test finding",
  description: "d",
  category: "quality",
  severity: "medium",
  confidence: "high",
  file: "src/a.ts",
  line: 5,
  end_line: 5,
  snippet: "const a = 1;",
  snippet_start_line: 4,
  remediation: null,
  references: [],
  suppressed: false,
  suppression_reason: null,
};

function mockHealth(ai: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/health")) {
        return Promise.resolve({ ok: true, json: async () => ({ ai }) });
      }
      return Promise.reject(new Error("unexpected call"));
    }),
  );
}

beforeEach(() => vi.unstubAllGlobals());

describe("AiActions", () => {
  it("disables actions and states the real reason when AI is unconfigured", async () => {
    mockHealth({
      configured: false,
      available: false,
      state: "unconfigured",
      model: null,
      reason: "No GEMINI_API_KEY is configured on the server.",
      retry_after_seconds: null,
    });

    render(<AiActions finding={finding} reportId="r1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No GEMINI_API_KEY is configured on the server."),
      ).toBeInTheDocument();
    });

    // Buttons stay visible but inert — never hidden, never faked.
    for (const label of ["Explain", "Propose fix", "Generate test"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it("explains a rate limit rather than showing a generic failure", async () => {
    mockHealth({
      configured: true,
      available: false,
      state: "cooling_down",
      model: "gemini-3.6-flash",
      reason: "Gemini API quota exceeded or rate limited.",
      retry_after_seconds: 60,
    });

    render(<AiActions finding={finding} reportId="r1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/quota exceeded or rate limited/i),
      ).toBeInTheDocument();
    });
  });

  it("runs an action and shows the exact context that was sent", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("/api/health")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ai: {
                configured: true,
                available: true,
                state: "ready",
                model: "gemini-3.6-flash",
                reason: null,
                retry_after_seconds: null,
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            action: "explain",
            output: "### What this is\nA thing.",
            model: "gemini-3.6-flash",
            context: "acme/app · src/a.ts · lines 4–5",
            cached: false,
          }),
        });
      }),
    );

    render(<AiActions finding={finding} reportId="r1" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Explain" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Explain" }));

    // The user must be able to see what the model was given.
    expect(await screen.findByText("acme/app · src/a.ts · lines 4–5")).toBeInTheDocument();
    expect(screen.getByText(/A thing\./)).toBeInTheDocument();
  });

  it("shows the backend's message when an action fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("/api/health")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ai: {
                configured: true,
                available: true,
                state: "ready",
                model: "m",
                reason: null,
                retry_after_seconds: null,
              },
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: async () => ({
            code: "ai_unavailable",
            message: "The model returned an unusable response",
            detail: "Expected a unified diff; got prose.",
          }),
        });
      }),
    );

    render(<AiActions finding={finding} reportId="r1" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Propose fix" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Propose fix" }));

    expect(
      await screen.findByText("The model returned an unusable response"),
    ).toBeInTheDocument();
    expect(screen.getByText("Expected a unified diff; got prose.")).toBeInTheDocument();
  });
});
