import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.argv[2] ?? "http://localhost:3000/api/mcp");
const adminMode = process.argv.includes("--admin");
const evaluateTextMode = process.argv.includes("--evaluate-text");
const extendedMode = process.argv.includes("--extended");

function parseTextResult(result) {
  const block = result.content?.find((item) => item.type === "text");
  return block?.text ? JSON.parse(block.text) : undefined;
}

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
  let extendedVerification;
  let listedApplications;
  if (adminMode) {
    const result = await client.callTool({
      name: "list_applications",
      arguments: { limit: extendedMode ? 2 : 1 },
    });
    adminVerified = result.isError !== true;
    listedApplications = parseTextResult(result)?.applications;
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
    const parsed = parseTextResult(result);
    textEvaluation = {
      verified: Boolean(parsed),
      finalScore: parsed?.final_score,
      recommendation: parsed?.recommendation,
    };
  }
  if (extendedMode) {
    if (!adminMode) throw new Error("--extended requires --admin.");
    const first = listedApplications?.[0];
    if (!first?.id) throw new Error("No application is available to verify.");
    const [searchResult, summaryResult, rubricResult, cvResult] =
      await Promise.all([
        client.callTool({
          name: "search_applications",
          arguments: { query: String(first.application_number), limit: 1 },
        }),
        client.callTool({ name: "get_dashboard_summary", arguments: {} }),
        client.callTool({ name: "get_active_rubric", arguments: {} }),
        client.callTool({
          name: "get_application_cv",
          arguments: {
            application_id: first.id,
            delivery: "resource_link",
          },
        }),
      ]);
    const resource = cvResult.content?.find(
      (item) => item.type === "resource_link",
    );
    const cvResponse = resource?.uri ? await fetch(resource.uri) : undefined;
    const second = listedApplications?.[1];
    const comparison = second?.id
      ? await client.callTool({
          name: "compare_applications",
          arguments: { application_ids: [first.id, second.id] },
        })
      : undefined;
    const embeddedCv = await client.callTool({
      name: "get_application_cv",
      arguments: { application_id: first.id, delivery: "embedded" },
    });
    const embeddedResource = embeddedCv.content?.find(
      (item) => item.type === "resource",
    );
    const textCv = await client.callTool({
      name: "get_application_cv",
      arguments: {
        application_id: first.id,
        delivery: "text",
        max_characters: 100_000,
      },
    });
    const textBlocks = textCv.content?.filter((item) => item.type === "text");
    extendedVerification = {
      search: parseTextResult(searchResult)?.count === 1,
      summary: Number.isInteger(parseTextResult(summaryResult)?.total),
      rubric: Boolean(parseTextResult(rubricResult)?.id),
      cvResource: resource?.mimeType === "application/pdf",
      cvDownload: cvResponse?.ok === true,
      cvEmbedded:
        embeddedResource?.resource?.mimeType === "application/pdf" &&
        Boolean(embeddedResource.resource.blob),
      cvText:
        textCv.isError !== true &&
        textBlocks?.some((item) => item.text.includes("<untrusted_cv_text>")),
      comparison: comparison ? comparison.isError !== true : "skipped",
      toolAnnotations: tools.every(
        (tool) => tool.title && tool.annotations?.readOnlyHint !== undefined,
      ),
    };
  }
  process.stdout.write(
    `${JSON.stringify({ endpoint: endpoint.toString(), tools: tools.map((tool) => tool.name), adminVerified, textEvaluation, extendedVerification }, null, 2)}\n`,
  );
} finally {
  await client.close();
}
