import { CV_MIME_TYPES } from "@/lib/schemas/application";

type CvMimeType = (typeof CV_MIME_TYPES)[number];

const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

function startsWith(bytes: Uint8Array, signature: Uint8Array) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function hasValidCvSignature(bytes: Uint8Array, type: CvMimeType) {
  return type === "application/pdf" && startsWith(bytes, PDF_SIGNATURE);
}

export function sanitizeCvFileName(originalName: string) {
  const withoutExtension = originalName.replace(/\.[^.]+$/u, "");
  const safeBase = withoutExtension
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);

  return `${safeBase || "cv"}.pdf`;
}
