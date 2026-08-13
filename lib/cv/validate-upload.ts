import {
  CV_MIME_TYPES,
  type ValidatedApplicationForm,
} from "@/lib/schemas/application";

type CvMimeType = (typeof CV_MIME_TYPES)[number];

const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const ZIP_SIGNATURES = [
  new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
  new Uint8Array([0x50, 0x4b, 0x07, 0x08]),
];

function startsWith(bytes: Uint8Array, signature: Uint8Array) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function hasValidCvSignature(bytes: Uint8Array, type: CvMimeType) {
  if (type === "application/pdf") {
    return startsWith(bytes, PDF_SIGNATURE);
  }

  if (!ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature))) {
    return false;
  }

  const archiveText = new TextDecoder("latin1").decode(bytes);
  return (
    archiveText.includes("[Content_Types].xml") && archiveText.includes("word/")
  );
}

export function sanitizeCvFileName(
  originalName: string,
  type: ValidatedApplicationForm["cv"]["type"],
) {
  const extension = type === "application/pdf" ? "pdf" : "docx";
  const withoutExtension = originalName.replace(/\.[^.]+$/u, "");
  const safeBase = withoutExtension
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);

  return `${safeBase || "cv"}.${extension}`;
}
