import { describe, expect, it } from "vitest";

describe("MCP OAuth metadata", () => {
  it("advertises the protected MCP resource and admin scope", async () => {
    const { GET } =
      await import("@/app/.well-known/oauth-protected-resource/route");
    const response = GET(
      new Request(
        "https://applyzer.example/.well-known/oauth-protected-resource",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: "https://applyzer.example/api/mcp",
      authorization_servers: ["https://applyzer.example"],
      scopes_supported: ["admin"],
    });
  });

  it("advertises authorization code, PKCE and dynamic registration", async () => {
    const { GET } =
      await import("@/app/.well-known/oauth-authorization-server/route");
    const response = GET(
      new Request(
        "https://applyzer.example/.well-known/oauth-authorization-server",
      ),
    );

    await expect(response.json()).resolves.toMatchObject({
      issuer: "https://applyzer.example",
      authorization_endpoint: "https://applyzer.example/oauth/authorize",
      token_endpoint: "https://applyzer.example/oauth/token",
      registration_endpoint: "https://applyzer.example/oauth/register",
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
    });
  });
});
