import { beforeEach, describe, expect, it } from "vitest";

import {
  createMcpAccessToken,
  isAllowedOAuthRedirect,
  MCP_ACCESS_TOKEN_DURATION_SECONDS,
  sha256Base64Url,
  verifyMcpAccessToken,
} from "@/lib/auth/mcp-oauth";

describe("MCP OAuth security", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "a-long-test-admin-password";
  });

  it("issues an eight-hour admin token and rejects tampering or expiry", async () => {
    const now = Date.UTC(2026, 7, 13, 12);
    const { token } = await createMcpAccessToken(
      "5b18f16f-e846-4a25-a438-cb3ef1bbf5d8",
      now,
    );

    await expect(verifyMcpAccessToken(token, now)).resolves.toMatchObject({
      client_id: "5b18f16f-e846-4a25-a438-cb3ef1bbf5d8",
      scopes: ["admin"],
    });
    await expect(
      verifyMcpAccessToken(
        token,
        now + MCP_ACCESS_TOKEN_DURATION_SECONDS * 1000,
      ),
    ).resolves.toBeNull();
    await expect(
      verifyMcpAccessToken(`${token.slice(0, -1)}x`, now),
    ).resolves.toBeNull();
  });

  it("accepts HTTPS and loopback callbacks but rejects unsafe redirects", () => {
    expect(isAllowedOAuthRedirect("https://claude.ai/api/mcp/callback")).toBe(
      true,
    );
    expect(isAllowedOAuthRedirect("http://127.0.0.1:39271/callback")).toBe(
      true,
    );
    expect(isAllowedOAuthRedirect("http://example.com/callback")).toBe(false);
    expect(isAllowedOAuthRedirect("javascript:alert(1)")).toBe(false);
    expect(isAllowedOAuthRedirect("https://user:pass@example.com/cb")).toBe(
      false,
    );
  });

  it("produces the RFC 7636 S256 PKCE challenge", async () => {
    await expect(
      sha256Base64Url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
