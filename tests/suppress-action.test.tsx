import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SuppressAction } from "@/components/report/suppress-action";
import type { Finding } from "@/lib/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

let signedIn = true;
vi.mock("@/lib/use-session", () => ({
  useSession: () => ({
    user: signedIn ? { id: "u1", login: "octocat" } : null,
    configured: true,
    reason: null,
    loading: false,
  }),
}));

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
    file: "src/a.ts",
    line: 10,
    end_line: 10,
    snippet: null,
    snippet_start_line: null,
    remediation: null,
    references: [],
    suppressed: false,
    priority: 0,
    suppression_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  signedIn = true;
  refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
});

describe("SuppressAction", () => {
  it("is absent for someone who only holds the link", () => {
    // A control that can only ever be refused is worse than no control: the
    // reason it would fail is not something a button can usefully say.
    const { container } = render(
      <SuppressAction finding={finding()} reportId="r1" canSuppress={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is absent when signed out", () => {
    signedIn = false;
    const { container } = render(
      <SuppressAction finding={finding()} reportId="r1" canSuppress />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("sends the reason and refreshes so the score and counts agree", async () => {
    const user = userEvent.setup();
    render(<SuppressAction finding={finding()} reportId="r1" canSuppress />);

    await user.click(screen.getByRole("button", { name: "Not an issue" }));
    await user.type(
      screen.getByLabelText(/reason for accepting/i),
      "vendored fixture",
    );
    await user.click(screen.getByRole("button", { name: "Accept" }));

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/reports/r1/findings/f1/suppression");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ reason: "vendored fixture" });

    // The server recomputes the score; patching local state would let the
    // header and the list disagree.
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("offers a way back, and says why it was accepted", async () => {
    const user = userEvent.setup();
    render(
      <SuppressAction
        finding={finding({ suppressed: true, suppression_reason: "vendored" })}
        reportId="r1"
        canSuppress
      />,
    );

    expect(screen.getByText(/vendored/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /restore/i }));

    expect(vi.mocked(fetch).mock.calls[0]![1]?.method).toBe("DELETE");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces the server's refusal rather than appearing to succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "That report isn't yours to change." }),
      }),
    );
    const user = userEvent.setup();
    render(<SuppressAction finding={finding()} reportId="r1" canSuppress />);

    await user.click(screen.getByRole("button", { name: "Not an issue" }));
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(
      await screen.findByText("That report isn't yours to change."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
