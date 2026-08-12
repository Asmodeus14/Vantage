import { beforeAll, describe, expect, it, vi } from "vitest";

// The module reads SESSION_SECRET at import time via lib/config.
vi.mock("@/lib/config", () => ({
  SESSION_SECRET: "test-secret-value-for-signing-state",
  SESSION_COOKIE: "cc_session",
}));

// `next/headers` is server-runtime only; nothing under test here touches it,
// but the import must resolve.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let createState: typeof import("@/lib/session").createState;
let verifyState: typeof import("@/lib/session").verifyState;
let safeReturnTo: typeof import("@/lib/session").safeReturnTo;

beforeAll(async () => {
  const mod = await import("@/lib/session");
  createState = mod.createState;
  verifyState = mod.verifyState;
  safeReturnTo = mod.safeReturnTo;
});

describe("OAuth state", () => {
  it("round-trips the return path", () => {
    const result = verifyState(createState("/r/abc123?tab=findings"));
    expect(result.valid).toBe(true);
    expect(result.returnTo).toBe("/r/abc123?tab=findings");
  });

  it("is different every time, so one cannot be replayed as another", () => {
    expect(createState("/")).not.toBe(createState("/"));
  });

  it("rejects a tampered return path", () => {
    // The whole point: an attacker editing the payload must invalidate it.
    const state = createState("/settings");
    const tampered = state.replace("%2Fsettings", "%2Fevil");
    expect(verifyState(tampered).valid).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const state = createState("/");
    const parts = state.split(".");
    parts[3] = "not-the-real-signature";
    expect(verifyState(parts.join(".")).valid).toBe(false);
  });

  it("rejects a missing or malformed state", () => {
    expect(verifyState(null).valid).toBe(false);
    expect(verifyState("").valid).toBe(false);
    expect(verifyState("a.b.c").valid).toBe(false);
    expect(verifyState("garbage").valid).toBe(false);
  });

  it("explains itself rather than failing silently", () => {
    expect(verifyState(null).reason).toBeTruthy();
    expect(verifyState("a.b.c").reason).toBeTruthy();
  });

  it("expires", () => {
    const state = createState("/");
    // Eleven minutes on; the TTL is ten.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    const result = verifyState(state);
    vi.restoreAllMocks();

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too long/i);
  });

  it("always falls back to the site root on failure", () => {
    expect(verifyState("garbage").returnTo).toBe("/");
  });
});

describe("safeReturnTo", () => {
  it("keeps ordinary in-site paths", () => {
    expect(safeReturnTo("/history")).toBe("/history");
    expect(safeReturnTo("/r/abc?tab=activity")).toBe("/r/abc?tab=activity");
  });

  it("refuses absolute URLs, so sign-in is not an open redirect", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("http://evil.example")).toBe("/");
  });

  it("refuses protocol-relative forms", () => {
    // Browsers treat both of these as "go to another host".
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
  });

  it("refuses anything not rooted at /", () => {
    expect(safeReturnTo("javascript:alert(1)")).toBe("/");
    expect(safeReturnTo("evil")).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("survives a hostile path round-tripping through state", () => {
    expect(verifyState(createState("//evil.example")).returnTo).toBe("/");
  });
});
