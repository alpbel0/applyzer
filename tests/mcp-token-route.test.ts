import { beforeEach, describe, expect, it, vi } from "vitest";

const redeemMcpAuthorizationCode = vi.fn();

vi.mock("@/lib/auth/mcp-oauth", () => ({
  redeemMcpAuthorizationCode,
}));

function tokenRequest(fields: Record<string, string>) {
  return new Request("https://applyzer.example/oauth/token", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

describe("POST /oauth/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redeemMcpAuthorizationCode.mockResolvedValue({
      token: "mcp_access-token",
      expiresAt: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    });
  });

  it("exchanges an authorization code with a PKCE verifier", async () => {
    const { POST } = await import("@/app/oauth/token/route");
    const response = await POST(
      tokenRequest({
        grant_type: "authorization_code",
        code: "one-time-code",
        client_id: "client-id",
        redirect_uri: "http://127.0.0.1:3000/callback",
        code_verifier: "v".repeat(43),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "mcp_access-token",
      token_type: "Bearer",
      scope: "admin",
    });
  });

  it("rejects an invalid or replayed authorization code", async () => {
    redeemMcpAuthorizationCode.mockResolvedValue(null);
    const { POST } = await import("@/app/oauth/token/route");
    const response = await POST(
      tokenRequest({
        grant_type: "authorization_code",
        code: "replayed-code",
        client_id: "client-id",
        redirect_uri: "http://127.0.0.1:3000/callback",
        code_verifier: "v".repeat(43),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
  });
});
