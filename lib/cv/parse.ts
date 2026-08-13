import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

export type PdfLinkMaterial = {
  text: string;
  embeddedUrls: string[];
};

export async function extractPdfLinkMaterial(
  bytes: Uint8Array,
): Promise<PdfLinkMaterial> {
  Object.defineProperties(globalThis, {
    DOMMatrix: { configurable: true, value: DOMMatrix, writable: true },
    ImageData: { configurable: true, value: ImageData, writable: true },
    Path2D: { configurable: true, value: Path2D, writable: true },
  });

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo({ parsePageInfo: true });

    return {
      text: textResult.text,
      embeddedUrls: infoResult.pages.flatMap((page) =>
        page.links.map((link) => link.url),
      ),
    };
  } finally {
    await parser.destroy();
  }
}
