import { McpAuthorizeForm } from "@/components/auth/McpAuthorizeForm";
import { Card } from "@/components/ui/Card";
import { getMcpOAuthClient } from "@/lib/auth/mcp-oauth";

export const dynamic = "force-dynamic";

function parameter(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clientId = parameter(params, "client_id");
  const redirectUri = parameter(params, "redirect_uri");
  const responseType = parameter(params, "response_type");
  const codeChallenge = parameter(params, "code_challenge");
  const challengeMethod = parameter(params, "code_challenge_method");
  const scope = parameter(params, "scope");
  const state = parameter(params, "state");
  const client = clientId ? await getMcpOAuthClient(clientId) : null;
  const valid =
    client &&
    client.redirect_uris.includes(redirectUri) &&
    responseType === "code" &&
    challengeMethod === "S256" &&
    /^[A-Za-z0-9_-]{43,128}$/u.test(codeChallenge) &&
    scope.split(/\s+/u).includes("admin") &&
    state.length <= 2048;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f1e7] px-5 py-12">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#16213e] text-xl font-black text-white">
          K
        </div>
        {valid ? (
          <>
            <p className="mt-7 text-xs font-bold tracking-[0.16em] text-[#b66d0d] uppercase">
              MCP yönetici yetkisi
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              Applyzer’a bağlan
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#687184]">
              <strong>{client.client_name}</strong> aday listesini ve
              değerlendirme ayrıntılarını görmek istiyor.
            </p>
            <McpAuthorizeForm
              clientId={clientId}
              redirectUri={redirectUri}
              codeChallenge={codeChallenge}
              state={state}
            />
          </>
        ) : (
          <>
            <h1 className="mt-7 text-3xl font-black tracking-[-0.04em]">
              Geçersiz yetkilendirme isteği
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#687184]">
              MCP istemcisi, callback adresi veya PKCE bilgisi doğrulanamadı.
              İstemciden bağlantıyı yeniden başlatın.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
