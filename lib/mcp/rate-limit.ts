import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";

const encoder = new TextEncoder();

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function consumeMcpRateLimit(
  headers: Headers,
  action: string,
  limit: number,
) {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const key = await sha256Hex(`mcp:${action}:${hour}:${ip}`);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_mcp_submission_limit", {
    p_key: key,
    p_limit: limit,
  });
  if (error) throw error;
  return data === true;
}
