import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn(() => ({ upload, remove }));
const single = vi.fn();
const select = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select }));
const databaseFrom = vi.fn(() => ({ insert }));

vi.mock("@/lib/db/client", () => ({
  createSupabaseAdminClient: () => ({
    from: databaseFrom,
    storage: { from: storageFrom },
  }),
}));

function validFormData() {
  const formData = new FormData();
  formData.set("full_name", "Ada Lovelace");
  formData.set("email", "ada@example.com");
  formData.set("department_year", "Bilgisayar Mühendisliği, 3. sınıf");
  formData.set("technologies", "TypeScript, Node.js, PostgreSQL");
  formData.append("bonus_tools", "Cursor");
  formData.set("links", "https://github.com/ada");
  formData.set("self_introduction", "Yeni ürünler geliştirmeyi seviyorum.");
  formData.set("llm_experience", "Bir LLM API entegrasyonu geliştirdim.");
  formData.set("office_days_per_week", "3");
  formData.set("privacy_consent", "true");
  formData.set(
    "cv",
    new File([new TextEncoder().encode("%PDF-1.7\nexample")], "ada.pdf", {
      type: "application/pdf",
    }),
  );
  return formData;
}

describe("POST /api/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: { application_number: 42 }, error: null });
  });

  it("stores a valid application and returns only its number", async () => {
    const { POST } = await import("@/app/api/applications/route");
    const response = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: validFormData(),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ application_number: 42 });
    expect(storageFrom).toHaveBeenCalledWith("cvs");
    expect(databaseFrom).toHaveBeenCalledWith("applications");
  });

  it("rejects a fake PDF before upload", async () => {
    const formData = validFormData();
    formData.set(
      "cv",
      new File(["not a pdf"], "fake.pdf", { type: "application/pdf" }),
    );
    const { POST } = await import("@/app/api/applications/route");
    const response = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(415);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects oversized files and honeypot submissions", async () => {
    const oversized = validFormData();
    oversized.set(
      "cv",
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.pdf", {
        type: "application/pdf",
      }),
    );
    const { POST } = await import("@/app/api/applications/route");
    const largeResponse = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: oversized,
      }),
    );
    expect(largeResponse.status).toBe(413);

    const bot = validFormData();
    bot.set("company_website", "https://spam.example");
    const botResponse = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: bot,
      }),
    );
    expect(botResponse.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes the CV when the database insert fails", async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: new Error("insert failed"),
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/applications/route");
    const response = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: validFormData(),
      }),
    );

    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
