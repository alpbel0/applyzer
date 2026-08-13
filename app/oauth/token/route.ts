import { redeemMcpAuthorizationCode } from "@/lib/auth/mcp-oauth";

function tokenHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function oauthError(description: string) {
  return Response.json(
    { error: "invalid_grant", error_description: description },
    { status: 400, headers: tokenHeaders() },
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("Token request could not be read.");
  }
  if (form.get("grant_type") !== "authorization_code") {
    return Response.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: tokenHeaders() },
    );
  }

  const code = String(form.get("code") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeVerifier = String(form.get("code_verifier") ?? "");
  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return oauthError("Required token parameters are missing.");
  }

  try {
    const result = await redeemMcpAuthorizationCode({
      code,
      clientId,
      redirectUri,
      codeVerifier,
    });
    if (!result) return oauthError("Authorization code is invalid or expired.");
    return Response.json(
      {
        access_token: result.token,
        token_type: "Bearer",
        expires_in: result.expiresAt - Math.floor(Date.now() / 1000),
        scope: "admin",
      },
      { headers: tokenHeaders() },
    );
  } catch (error) {
    console.error("MCP OAuth token exchange failed", error);
    return oauthError("Authorization code could not be exchanged.");
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: tokenHeaders() });
}
