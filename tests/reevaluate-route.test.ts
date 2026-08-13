import { beforeEach, describe, expect, it, vi } from "vitest";

let authenticated = false;
const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const statusIn = vi.fn(() => ({ select }));
const eq = vi.fn(() => ({ in: statusIn }));
const update = vi.fn(() => ({ eq }));
const databaseFrom = vi.fn(() => ({ update }));
const scheduleApplicationReevaluation = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  isAdminAuthenticated: () => Promise.resolve(authenticated),
}));

vi.mock("@/lib/db/client", () => ({
  createSupabaseAdminClient: () => ({ from: databaseFrom }),
}));

vi.mock("@/lib/worker/schedule", () => ({
  scheduleApplicationReevaluation,
}));

const applicationId = "5b18f16f-e846-4a25-a438-cb3ef1bbf5d8";

describe("POST /api/applications/[id]/reevaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated = false;
    maybeSingle.mockResolvedValue({ data: { id: applicationId }, error: null });
  });

  it("rejects an unauthenticated request", async () => {
    const { POST } =
      await import("@/app/api/applications/[id]/reevaluate/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(401);
    expect(databaseFrom).not.toHaveBeenCalled();
  });

  it("claims a completed application and schedules reevaluation", async () => {
    authenticated = true;
    const { POST } =
      await import("@/app/api/applications/[id]/reevaluate/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(202);
    expect(update).toHaveBeenCalledWith({
      status: "evaluating",
      error_message: null,
    });
    expect(statusIn).toHaveBeenCalledWith("status", ["done", "failed"]);
    expect(scheduleApplicationReevaluation).toHaveBeenCalledWith(applicationId);
  });

  it("does not schedule an application that is already processing", async () => {
    authenticated = true;
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { POST } =
      await import("@/app/api/applications/[id]/reevaluate/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(409);
    expect(scheduleApplicationReevaluation).not.toHaveBeenCalled();
  });
});
