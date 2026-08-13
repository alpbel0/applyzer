import { describe, expect, it } from "vitest";

describe("extract-links module scaffold", () => {
  it("is available for Phase 3 implementation", async () => {
    await expect(import("@/lib/cv/extract-links")).resolves.toBeDefined();
  });
});
