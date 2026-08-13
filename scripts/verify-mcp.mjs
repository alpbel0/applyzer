import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.argv[2] ?? "http://localhost:3000/api/mcp");
const adminMode = process.argv.includes("--admin");
const evaluateTextMode = process.argv.includes("--evaluate-text");

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function createAdminToken() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) throw new Error("ADMIN_PASSWORD is required for --admin.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      type: "mcp_access",
      client_id: "00000000-0000-4000-8000-000000000010",
      scopes: ["admin"],
      issued_at: issuedAt,
      expires_at: issuedAt + 8 * 60 * 60,
      version: 1,
    }),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`applyzer:mcp-oauth:v1:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `mcp_${payload}.${base64Url(new Uint8Array(signature))}`;
}

const token = adminMode
  ? await createAdminToken()
  : process.env.MCP_TEST_ACCESS_TOKEN?.trim();
const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined,
});
const client = new Client({ name: "applyzer-verifier", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  let adminVerified = false;
  let textEvaluation;
  if (adminMode) {
    const result = await client.callTool({
      name: "list_applications",
      arguments: { limit: 1 },
    });
    adminVerified = result.isError !== true;
  }
  if (evaluateTextMode) {
    if (!adminMode) {
      throw new Error("--evaluate-text requires --admin.");
    }
    const result = await client.callTool({
      name: "evaluate_text",
      arguments: {
        candidate_text:
          "Aday TypeScript, Next.js, PostgreSQL ve REST API projeleri geliştirmiştir. OpenAI Responses API ile structured output ve tool calling kullanmış, bir MCP sunucusu yazmıştır. Projelerini GitHub üzerinde doğrulanabilir README ve testlerle paylaşmıştır. Ankara ofisine haftada iki gün gelebilir.",
        office_days_per_week: "2",
      },
    });
    if (result.isError) throw new Error("evaluate_text returned an MCP error.");
    const block = result.content?.find((item) => item.type === "text");
    const parsed = block?.text ? JSON.parse(block.text) : undefined;
    textEvaluation = {
      verified: Boolean(parsed),
      finalScore: parsed?.final_score,
      recommendation: parsed?.recommendation,
    };
  }
  process.stdout.write(
    `${JSON.stringify({ endpoint: endpoint.toString(), tools: tools.map((tool) => tool.name), adminVerified, textEvaluation }, null, 2)}\n`,
  );
} finally {
  await client.close();
}
