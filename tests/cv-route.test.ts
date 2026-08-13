import { beforeEach, describe, expect, it, vi } from "vitest";

let authenticated = false;
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const databaseFrom = vi.fn(() => ({ select }));
const createSignedUrl = vi.fn();
const storageFrom = vi.fn(() => ({ createSignedUrl }));

vi.mock("@/lib/auth/admin", () => ({
  isAdminAuthenticated: () => Promise.resolve(authenticated),
}));

vi.mock("@/lib/db/client", () => ({
  createSupabaseAdminClient: () => ({
    from: databaseFrom,
    storage: { from: storageFrom },
  }),
}));

const applicationId = "5b18f16f-e846-4a25-a438-cb3ef1bbf5d8";

describe("GET /api/cv/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated = false;
    maybeSingle.mockResolvedValue({
      data: { cv_storage_path: `${applicationId}/candidate.pdf` },
      error: null,
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed-cv" },
      error: null,
    });
  });

  it("rejects an unauthenticated request before database access", async () => {
    const { GET } = await import("@/app/api/cv/[id]/route");
    const response = await GET(new Request("http://localhost/api/cv/x"), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(401);
    expect(databaseFrom).not.toHaveBeenCalled();
  });

  it("creates a five-minute signed URL for an authenticated admin", async () => {
    authenticated = true;
    const { GET } = await import("@/app/api/cv/[id]/route");
    const response = await GET(
      new Request(`http://localhost/api/cv/${applicationId}`),
      { params: Promise.resolve({ id: applicationId }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://storage.example/signed-cv",
    );
    expect(storageFrom).toHaveBeenCalledWith("cvs");
    expect(createSignedUrl).toHaveBeenCalledWith(
      `${applicationId}/candidate.pdf`,
      300,
    );
  });
});
