import { PDFParse } from "pdf-parse";

export type PdfLinkMaterial = {
  text: string;
  embeddedUrls: string[];
};

export async function extractPdfLinkMaterial(
  bytes: Uint8Array,
): Promise<PdfLinkMaterial> {
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
