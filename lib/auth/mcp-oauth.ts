import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";

export const MCP_ADMIN_SCOPE = "admin";
export const MCP_ACCESS_TOKEN_DURATION_SECONDS = 8 * 60 * 60;
export const MCP_AUTH_CODE_DURATION_SECONDS = 5 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type McpAccessTokenPayload = {
  type: "mcp_access";
  client_id: string;
  scopes: ["admin"];
  issued_at: number;
  expires_at: number;
  version: 1;
};

function oauthSecret() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) throw new Error("ADMIN_PASSWORD is not configured.");
  return `applyzer:mcp-oauth:v1:${password}`;
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(oauthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: McpAccessTokenPayload) {
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(encoded),
  );
  return `mcp_${encoded}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function createMcpAccessToken(clientId: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + MCP_ACCESS_TOKEN_DURATION_SECONDS;
  return {
    token: await signPayload({
      type: "mcp_access",
      client_id: clientId,
      scopes: [MCP_ADMIN_SCOPE],
      issued_at: issuedAt,
      expires_at: expiresAt,
      version: 1,
    }),
    expiresAt,
  };
}

export async function verifyMcpAccessToken(
  token: string | null | undefined,
  now = Date.now(),
) {
  if (!token?.startsWith("mcp_")) return null;
  const [encoded, signature, extra] = token.slice(4).split(".");
  if (!encoded || !signature || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature),
      encoder.encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      decoder.decode(fromBase64Url(encoded)),
    ) as Partial<McpAccessTokenPayload>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      payload.type !== "mcp_access" ||
      payload.version !== 1 ||
      !payload.client_id ||
      payload.scopes?.length !== 1 ||
      payload.scopes[0] !== MCP_ADMIN_SCOPE ||
      typeof payload.issued_at !== "number" ||
      typeof payload.expires_at !== "number" ||
      payload.issued_at > nowSeconds + 60 ||
      payload.expires_at <= nowSeconds ||
      payload.expires_at - payload.issued_at !==
        MCP_ACCESS_TOKEN_DURATION_SECONDS
    ) {
      return null;
    }
    return payload as McpAccessTokenPayload;
  } catch {
    return null;
  }
}

export function isAllowedOAuthRedirect(value: string) {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function registerMcpOAuthClient(input: {
  clientName: string;
  redirectUris: string[];
}) {
  if (
    input.redirectUris.length < 1 ||
    input.redirectUris.length > 10 ||
    input.redirectUris.some((uri) => !isAllowedOAuthRedirect(uri))
  ) {
    throw new Error("Invalid redirect URI.");
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mcp_oauth_clients")
    .insert({
      client_name: input.clientName.slice(0, 120),
      redirect_uris: [...new Set(input.redirectUris)],
    })
    .select("id, client_name, redirect_uris, created_at")
    .single();
  if (error) throw error;
  return data as {
    id: string;
    client_name: string;
    redirect_uris: string[];
    created_at: string;
  };
}

export async function getMcpOAuthClient(clientId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mcp_oauth_clients")
    .select("id, client_name, redirect_uris")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    client_name: string;
    redirect_uris: string[];
  } | null;
}

function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export async function issueMcpAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}) {
  const client = await getMcpOAuthClient(input.clientId);
  if (!client || !client.redirect_uris.includes(input.redirectUri)) {
    throw new Error("OAuth client or redirect URI is invalid.");
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(input.codeChallenge)) {
    throw new Error("PKCE challenge is invalid.");
  }

  const code = randomToken();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("mcp_oauth_codes").insert({
    code_hash: await sha256Hex(code),
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    scope: MCP_ADMIN_SCOPE,
    expires_at: new Date(
      Date.now() + MCP_AUTH_CODE_DURATION_SECONDS * 1000,
    ).toISOString(),
  });
  if (error) throw error;
  return code;
}

export async function redeemMcpAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/u.test(input.codeVerifier)) return null;
  const codeHash = await sha256Hex(input.code);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mcp_oauth_codes")
    .select(
      "code_hash, client_id, redirect_uri, code_challenge, scope, expires_at, used_at",
    )
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;
  if (
    !data ||
    data.used_at ||
    data.client_id !== input.clientId ||
    data.redirect_uri !== input.redirectUri ||
    data.scope !== MCP_ADMIN_SCOPE ||
    new Date(data.expires_at).getTime() <= Date.now() ||
    (await sha256Base64Url(input.codeVerifier)) !== data.code_challenge
  ) {
    return null;
  }

  const { data: claimed, error: claimError } = await supabase
    .from("mcp_oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .select("code_hash")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;
  return createMcpAccessToken(input.clientId);
}
