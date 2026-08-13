import { z } from "zod";

import { registerMcpOAuthClient } from "@/lib/auth/mcp-oauth";
import { consumeMcpRateLimit } from "@/lib/mcp/rate-limit";

const registrationSchema = z
  .object({
    redirect_uris: z.array(z.string()).min(1).max(10),
    client_name: z.string().trim().min(1).max(120).optional(),
    token_endpoint_auth_method: z.literal("none").optional(),
    grant_types: z.array(z.literal("authorization_code")).optional(),
    response_types: z.array(z.literal("code")).optional(),
    scope: z.string().optional(),
  })
  .passthrough();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function POST(request: Request) {
  try {
    if (!(await consumeMcpRateLimit(request.headers, "register", 20))) {
      return Response.json(
        {
          error: "invalid_client_metadata",
          error_description: "Too many registration attempts.",
        },
        { status: 429, headers: corsHeaders() },
      );
    }
  } catch (error) {
    console.error("MCP OAuth registration rate limit failed", error);
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: corsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Invalid JSON." },
      { status: 400, headers: corsHeaders() },
    );
  }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_client_metadata",
        error_description: "Client metadata is invalid.",
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const client = await registerMcpOAuthClient({
      clientName: parsed.data.client_name ?? "MCP Client",
      redirectUris: parsed.data.redirect_uris,
    });
    return Response.json(
      {
        client_id: client.id,
        client_id_issued_at: Math.floor(
          new Date(client.created_at).getTime() / 1000,
        ),
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "admin",
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    console.error("MCP OAuth client registration failed", error);
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "Redirect URI is not allowed.",
      },
      { status: 400, headers: corsHeaders() },
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
