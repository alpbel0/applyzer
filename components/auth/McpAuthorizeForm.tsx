"use client";

import { useActionState } from "react";

import {
  authorizeMcpClient,
  type McpAuthorizeState,
} from "@/app/oauth/authorize/actions";
import { Button } from "@/components/ui/Button";

const initialState: McpAuthorizeState = { error: null };

export function McpAuthorizeForm({
  clientId,
  redirectUri,
  codeChallenge,
  state,
}: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}) {
  const [formState, action, pending] = useActionState(
    authorizeMcpClient,
    initialState,
  );

  return (
    <form action={action} className="mt-7 space-y-5">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="state" value={state} />
      <div>
        <label htmlFor="mcp-admin-password" className="form-label">
          Yönetici şifresi
        </label>
        <input
          id="mcp-admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="form-control"
        />
      </div>
      {formState.error ? (
        <p role="alert" className="text-sm font-semibold text-[#a83c3c]">
          {formState.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Yetkilendiriliyor…" : "MCP admin erişimini aç"}
      </Button>
      <p className="text-center text-xs leading-5 text-[#858b97]">
        Şifreniz MCP istemcisine veya AI sohbetine gönderilmez. Yetki 8 saat
        geçerlidir.
      </p>
    </form>
  );
}
