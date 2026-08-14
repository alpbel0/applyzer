import { describe, expect, it, vi } from "vitest";

import { assertPublicUrl, enrichGenericLink } from "@/lib/enrichment/generic";

const publicResolver = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 as const },
]);

const articleHtml = `<!doctype html><html><head><title>Teknik portfolyo</title></head>
<body><main><article><h1>Teknik portfolyo</h1>${Array.from(
  { length: 12 },
  (_, index) =>
    `<p>Proje ${index + 1}, REST API, veritabanı, test ve LLM entegrasyonunun nasıl kurulduğunu somut teknik kararlarla açıklıyor.</p>`,
).join("")}</article></main></body></html>`;

describe("Generic enrichment", () => {
  it("blocks private and metadata targets before fetch", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/admin")).rejects.toThrow(
      "Private URL",
    );
    await expect(assertPublicUrl("http://[::1]/admin")).rejects.toThrow(
      "Private URL",
    );
    await expect(
      assertPublicUrl("http://metadata.google.internal/", publicResolver),
    ).rejects.toThrow("Private URL");
  });

  it("extracts readable content and produces a fixed summary", async () => {
    const result = await enrichGenericLink("https://portfolio.example.com", {
      resolver: publicResolver,
      fetcher: (async () =>
        new Response(articleHtml, {
          status: 200,
          headers: { "content-type": "text/html" },
        })) as typeof fetch,
      summarize: async () => ({
        lines: ["REST API projesi var.", "Test kullanılmış.", "LLM bağlanmış."],
        fallback: false,
      }),
    });

    expect(result).toMatchObject({
      source: "generic",
      status: "ok",
      data: {
        title: "Teknik portfolyo",
        summary: "REST API projesi var.\nTest kullanılmış.\nLLM bağlanmış.",
      },
    });
  });

  it("marks JS-only or too-short pages unreachable", async () => {
    const result = await enrichGenericLink("https://app.example.com", {
      resolver: publicResolver,
      fetcher: (async () =>
        new Response("<html><body><div id='root'></div></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })) as typeof fetch,
    });
    expect(result).toMatchObject({
      source: "generic",
      status: "unreachable",
      data: null,
    });
  });
});
