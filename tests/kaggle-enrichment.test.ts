import { describe, expect, it } from "vitest";

import {
  enrichKaggleLink,
  kaggleAuthorization,
  parseKaggleUsername,
} from "@/lib/enrichment/kaggle";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Kaggle enrichment", () => {
  it("parses profile URLs without guessing users", () => {
    expect(parseKaggleUsername("https://www.kaggle.com/alpbel0/code")).toBe(
      "alpbel0",
    );
    expect(parseKaggleUsername("https://kaggle.com/code")).toBeNull();
    expect(parseKaggleUsername("https://example.com/alpbel0")).toBeNull();
  });

  it("supports modern bearer and legacy JSON credentials", () => {
    expect(kaggleAuthorization("KGAT_example")).toBe("Bearer KGAT_example");
    expect(
      kaggleAuthorization(JSON.stringify({ username: "user", key: "key" })),
    ).toBe(`Basic ${Buffer.from("user:key").toString("base64")}`);
  });

  it("collects notebook count, votes, activity and titles", async () => {
    const requests: URL[] = [];
    const result = await enrichKaggleLink("https://kaggle.com/demo-user", {
      token: "KGAT_test",
      fetcher: (async (input, init) => {
        requests.push(new URL(String(input)));
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer KGAT_test",
        );
        return jsonResponse([
          {
            title: "Agent değerlendirmesi",
            totalVotes: 7,
            lastRunTime: "2026-08-01T12:00:00Z",
          },
          {
            title: "NLP deneyi",
            totalVotes: 3,
            lastRunTime: "2026-07-20T12:00:00Z",
          },
        ]);
      }) as typeof fetch,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get("user")).toBe("demo-user");
    expect(result).toMatchObject({
      source: "kaggle",
      status: "ok",
      data: {
        notebook_count: 2,
        total_votes: 10,
        last_activity: "2026-08-01",
        titles: ["Agent değerlendirmesi", "NLP deneyi"],
      },
    });
  });

  it("stores an empty profile as ok with empty data", async () => {
    const result = await enrichKaggleLink("https://kaggle.com/empty-user", {
      token: "KGAT_test",
      fetcher: (async () => jsonResponse([])) as typeof fetch,
    });

    expect(result).toMatchObject({
      status: "ok",
      data: {
        notebook_count: 0,
        total_votes: 0,
        last_activity: null,
        titles: [],
      },
    });
  });
});
