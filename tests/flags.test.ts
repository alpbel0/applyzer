import { describe, expect, it } from "vitest";

import { extractRepositoryFlags } from "@/lib/enrichment/flags";

describe("extractRepositoryFlags", () => {
  it("extracts all deterministic repository signals", () => {
    expect(
      extractRepositoryFlags({
        paths: [
          ".github/workflows/test.yml",
          ".cursor/rules/project.mdc",
          "Dockerfile",
          "alembic/versions/001.py",
          "package.json",
          "prompts/system.md",
          "src/mcp/server.ts",
          "tests/agent.spec.ts",
        ],
        readme:
          "This project uses OpenAI, Anthropic and LangGraph with @modelcontextprotocol/sdk.",
        readmeSize: 2048,
      }),
    ).toEqual([
      "tests",
      "ci",
      "docker",
      "mcp",
      "llm_sdk",
      "agent_framework",
      "prompt_management",
      "ai_tool",
      "db",
      "documentation",
    ]);
  });
});
