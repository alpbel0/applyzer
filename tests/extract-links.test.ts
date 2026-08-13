import { describe, expect, it } from "vitest";

import {
  classifyLink,
  extractLinks,
  normalizeUrl,
} from "@/lib/cv/extract-links";

describe("CV link extraction", () => {
  it("extracts, normalizes, classifies and deduplicates URLs", () => {
    expect(
      extractLinks([
        "GitHub: https://github.com/alpbel0, portfolio https://alpbel.dev.",
        "github.com/alpbel0 https://medium.com/@alpbel)",
      ]),
    ).toEqual([
      { url: "https://github.com/alpbel0", source: "github" },
      { url: "https://alpbel.dev/", source: "generic" },
      { url: "https://medium.com/@alpbel", source: "medium" },
    ]);
  });

  it("accepts labeled usernames without guessing from a person's name", () => {
    expect(extractLinks(["GitHub: alpbel0\nKaggle - data_user"])).toEqual([
      { url: "https://github.com/alpbel0", source: "github" },
      { url: "https://kaggle.com/data_user", source: "kaggle" },
    ]);
    expect(extractLinks(["Yiğitalp Bel"])).toEqual([]);
  });

  it("routes supported domains and skips malformed input", () => {
    expect(classifyLink("https://www.linkedin.com/in/example")).toBe(
      "linkedin",
    );
    expect(classifyLink("https://portfolio.example")).toBe("generic");
    expect(classifyLink("not a url")).toBe("skipped");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("removes trailing punctuation without damaging URL paths", () => {
    expect(normalizeUrl("https://github.com/alpbel0/repo).")).toBe(
      "https://github.com/alpbel0/repo",
    );
  });
});
