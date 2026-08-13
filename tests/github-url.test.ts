import { describe, expect, it } from "vitest";

import { parseGitHubUrl } from "@/lib/enrichment/github-url";

describe("parseGitHubUrl", () => {
  it("parses profile and repository URLs", () => {
    expect(parseGitHubUrl("https://github.com/alpbel0")).toEqual({
      type: "profile",
      username: "alpbel0",
    });
    expect(
      parseGitHubUrl(
        "https://www.github.com/alpbel0/MentorMind.git/blob/main/x",
      ),
    ).toEqual({
      type: "repository",
      username: "alpbel0",
      repository: "MentorMind",
    });
  });

  it("rejects non-GitHub and reserved routes", () => {
    expect(parseGitHubUrl("https://example.com/alpbel0/repo")).toBeNull();
    expect(parseGitHubUrl("https://github.com/settings/profile")).toBeNull();
    expect(parseGitHubUrl("https://github.com/search?q=applyzer")).toBeNull();
  });
});
