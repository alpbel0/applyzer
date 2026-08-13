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

  it("recognizes a DOCX-shaped ZIP archive", () => {
    const bytes = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...new TextEncoder().encode("[Content_Types].xml word/document.xml"),
    ]);
    expect(
      hasValidCvSignature(
        bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("sanitizes file names and derives the trusted extension", () => {
    expect(
      sanitizeCvFileName("../../Yiğitalp CV (final).exe", "application/pdf"),
    ).toBe("Yigitalp-CV-final.pdf");
  });
});
