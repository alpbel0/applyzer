"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { verifyAdminPassword } from "@/lib/auth/session";
import { issueMcpAuthorizationCode } from "@/lib/auth/mcp-oauth";
import { consumeMcpRateLimit } from "@/lib/mcp/rate-limit";

export type McpAuthorizeState = { error: string | null };

export async function authorizeMcpClient(
  _state: McpAuthorizeState,
  formData: FormData,
): Promise<McpAuthorizeState> {
  const password = String(formData.get("password") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = String(formData.get("state") ?? "");

  const requestHeaders = await headers();
  if (!(await consumeMcpRateLimit(requestHeaders, "authorize", 5))) {
    return {
      error: "Çok fazla giriş denemesi. Bir saat sonra tekrar deneyin.",
    };
  }

  if (!(await verifyAdminPassword(password))) {
    return { error: "Yönetici şifresi yanlış." };
  }

  let code: string;
  try {
    code = await issueMcpAuthorizationCode({
      clientId,
      redirectUri,
      codeChallenge,
    });
  } catch (error) {
    console.error("MCP authorization failed", error);
    return { error: "Yetkilendirme tamamlanamadı." };
  }
  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);
  redirect(callback.toString());
}
