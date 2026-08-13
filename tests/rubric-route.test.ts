import { beforeEach, describe, expect, it, vi } from "vitest";

let authenticated = false;
const createRubricVersionAndRecalculate = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  isAdminAuthenticated: () => Promise.resolve(authenticated),
}));

vi.mock("@/lib/db/rubric", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/rubric")>();
  return { ...original, createRubricVersionAndRecalculate };
});

const weights = {
  rest_api: 0.15,
  llm_experience: 0.2,
  agentic_mcp: 0.2,
  bonus_tools: 0.15,
  verifiability: 0.15,
  learning_signal: 0.1,
  cv_quality: 0.05,
};

describe("POST /api/rubric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated = false;
    createRubricVersionAndRecalculate.mockResolvedValue({
      rubric_version_id: 2,
      recalculated_count: 6,
    });
  });

  it("rejects an unauthenticated request", async () => {
    const { POST } = await import("@/app/api/rubric/route");
    const response = await POST(
      new Request("http://localhost/api/rubric", {
        method: "POST",
        body: JSON.stringify({ weights }),
      }),
    );

    expect(response.status).toBe(401);
    expect(createRubricVersionAndRecalculate).not.toHaveBeenCalled();
  });

  it("creates a version and recalculates without an LLM call", async () => {
    authenticated = true;
    const { POST } = await import("@/app/api/rubric/route");
    const response = await POST(
      new Request("http://localhost/api/rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights, description: "MCP odaklı sürüm" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      rubric_version_id: 2,
      recalculated_count: 6,
    });
    expect(createRubricVersionAndRecalculate).toHaveBeenCalledWith({
      weights,
      description: "MCP odaklı sürüm",
    });
  });

  it("rejects weights that do not total 100 percent", async () => {
    authenticated = true;
    const { POST } = await import("@/app/api/rubric/route");
    const response = await POST(
      new Request("http://localhost/api/rubric", {
        method: "POST",
        body: JSON.stringify({
          weights: { ...weights, cv_quality: 0.1 },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createRubricVersionAndRecalculate).not.toHaveBeenCalled();
  });
});
