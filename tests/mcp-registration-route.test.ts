import { beforeEach, describe, expect, it, vi } from "vitest";

const registerMcpOAuthClient = vi.fn();
const consumeMcpRateLimit = vi.fn();

vi.mock("@/lib/auth/mcp-oauth", () => ({ registerMcpOAuthClient }));
vi.mock("@/lib/mcp/rate-limit", () => ({ consumeMcpRateLimit }));

function registrationRequest(body: unknown) {
  return new Request("https://applyzer.example/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /oauth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeMcpRateLimit.mockResolvedValue(true);
    registerMcpOAuthClient.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000020",
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      created_at: "2026-08-13T20:00:00.000Z",
    });
  });

  it("accepts DCR metadata containing additional grant capabilities", async () => {
    const { POST } = await import("@/app/oauth/register/route");
    const response = await POST(
      registrationRequest({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "admin",
        software_id: "claude-web",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      client_id: "00000000-0000-4000-8000-000000000020",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
    });
  });

  it("rejects clients that do not support authorization_code", async () => {
    const { POST } = await import("@/app/oauth/register/route");
    const response = await POST(
      registrationRequest({
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        grant_types: ["client_credentials"],
      }),
    );

    expect(response.status).toBe(400);
    expect(registerMcpOAuthClient).not.toHaveBeenCalled();
  });
});
