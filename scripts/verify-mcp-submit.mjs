import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const cvPath = process.argv[2];
const endpoint = new URL(process.argv[3] ?? "http://localhost:3000/api/mcp");
if (!cvPath) {
  throw new Error(
    "Usage: node scripts/verify-mcp-submit.mjs <pdf-path> [mcp-url]",
  );
}
const cv = await readFile(cvPath);
if (cv.byteLength > 3 * 1024 * 1024) {
  throw new Error("Verification PDF exceeds the MCP 3 MiB limit.");
}

const client = new Client({
  name: "applyzer-submit-verifier",
  version: "1.0.0",
});
const transport = new StreamableHTTPClientTransport(endpoint);

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "submit_application",
    arguments: {
      full_name: "MCP Test — Yigitalp BEL",
      email: `phase10-mcp-${Date.now()}@example.com`,
      department_year: "Software Engineering, 4th year",
      technologies: "TypeScript, Next.js, PostgreSQL, REST APIs, LLM APIs",
      bonus_tools: ["OpenAI API", "Cursor"],
      links: "https://github.com/alpbel0",
      self_introduction:
        "MCP üzerinden başvuru akışını doğrulamak için oluşturulan test adayı.",
      llm_experience:
        "Structured output, tool calling ve MCP sunucuları üzerinde çalışıyorum.",
      office_days_per_week: "remote_only",
      location_note: "MCP Faz 10 uçtan uca doğrulama kaydı.",
      privacy_consent: true,
      cv_file_name: "Yigitalp_BEL_CV_P3S.pdf",
      cv_base64: cv.toString("base64"),
    },
  });
  if (result.isError) throw new Error("MCP submit_application returned error.");
  process.stdout.write(`${JSON.stringify(result.content, null, 2)}\n`);
} finally {
  await client.close();
}
