import { describe, expect, it } from "vitest";

import {
  hasValidCvSignature,
  sanitizeCvFileName,
} from "@/lib/cv/validate-upload";

describe("CV upload validation", () => {
  it("recognizes PDF content", () => {
    expect(
      hasValidCvSignature(
        new TextEncoder().encode("%PDF-1.7\nexample"),
        "application/pdf",
      ),
    ).toBe(true);
  });

  it("rejects a fake PDF", () => {
    expect(
      hasValidCvSignature(
        new TextEncoder().encode("not a pdf"),
        "application/pdf",
      ),
    ).toBe(false);
  });

  it("sanitizes file names and derives the trusted extension", () => {
    expect(sanitizeCvFileName("../../Yiğitalp CV (final).exe")).toBe(
      "Yigitalp-CV-final.pdf",
    );
  });
});
