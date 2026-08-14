import { describe, expect, it } from "vitest";

import {
  enrichMediumLink,
  mediumFeedUrl,
  parseMediumFeed,
} from "@/lib/enrichment/medium";

const feed = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <item>
      <title>MCP ile araç tasarımı</title>
      <pubDate>Tue, 12 Aug 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Bir MCP sunucusunda araç sınırlarını ve güvenliği anlattım.</p>]]></content:encoded>
    </item>
    <item>
      <title>LLM değerlendirme notları</title>
      <pubDate>Mon, 11 Aug 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Rubric kalibrasyonunu karşılaştırdım.</p>]]></description>
    </item>
  </channel>
</rss>`;

describe("Medium enrichment", () => {
  it("builds official profile, subdomain and custom feed URLs", () => {
    expect(mediumFeedUrl("https://medium.com/@yigit/posts")).toBe(
      "https://medium.com/feed/@yigit",
    );
    expect(mediumFeedUrl("https://yigit.medium.com/post")).toBe(
      "https://yigit.medium.com/feed",
    );
    expect(mediumFeedUrl("https://blog.example.com/yazi", true)).toBe(
      "https://blog.example.com/feed",
    );
  });

  it("parses RSS titles, dates and HTML content", () => {
    expect(parseMediumFeed(feed)).toEqual([
      expect.objectContaining({
        title: "MCP ile araç tasarımı",
        content: expect.stringContaining("araç sınırlarını"),
      }),
      expect.objectContaining({ title: "LLM değerlendirme notları" }),
    ]);
  });

  it("summarizes a feed once and validates the stored shape", async () => {
    let summaryInput = "";
    const result = await enrichMediumLink("https://medium.com/@yigit", {
      fetcher: (async () =>
        new Response(feed, {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        })) as typeof fetch,
      summarize: async (text) => {
        summaryInput = text;
        return {
          lines: ["Birinci özet", "İkinci özet", "Üçüncü özet"],
          fallback: false,
        };
      },
    });

    expect(summaryInput).toContain("MCP ile araç tasarımı");
    expect(result).toMatchObject({
      source: "medium",
      status: "ok",
      data: {
        last_activity: "2026-08-12",
        titles: ["MCP ile araç tasarımı", "LLM değerlendirme notları"],
        summaries: ["Birinci özet", "İkinci özet", "Üçüncü özet"],
      },
    });
  });
});
