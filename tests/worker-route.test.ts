import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processApplicationLinks = vi.fn();
vi.mock("@/lib/worker/process-application", () => ({
  processApplicationLinks,
}));

describe("POST /api/worker", () => {
  beforeEach(() => {
    vi.stubEnv("WORKER_SECRET", "phase-3-test-secret");
    processApplicationLinks.mockResolvedValue({
      application_id: "6d90a97e-8dd8-4375-9f52-582a80c719b1",
      link_count: 2,
      status: "evaluating",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects requests without the worker secret", async () => {
    const { POST } = await import("@/app/api/worker/route");
    const response = await POST(
      new Request("http://localhost/api/worker", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(processApplicationLinks).not.toHaveBeenCalled();
  });

  it("processes a specific pending application", async () => {
    const { POST } = await import("@/app/api/worker/route");
    const applicationId = "6d90a97e-8dd8-4375-9f52-582a80c719b1";
    const response = await POST(
      new Request("http://localhost/api/worker", {
        method: "POST",
        headers: {
          authorization: "Bearer phase-3-test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ application_id: applicationId }),
      }),
    );

    expect(response.status).toBe(200);
    expect(processApplicationLinks).toHaveBeenCalledWith(applicationId);
    await expect(response.json()).resolves.toMatchObject({
      application_id: applicationId,
      link_count: 2,
      status: "evaluating",
    });
  });
});
