import { PDFDocument } from "pdf-lib";

const MAX_PAGES = 50;

/** Build a single PDF from ordered page image files (JPEG/PNG/WebP). */
export async function imagesToPdf(
  pages: File[],
  fileName: string,
): Promise<File> {
  if (pages.length === 0) {
    throw new Error("Add at least one page");
  }
  if (pages.length > MAX_PAGES) {
    throw new Error(`A scan can have at most ${MAX_PAGES} pages`);
  }

  const pdf = await PDFDocument.create();

  for (const page of pages) {
    const bytes = new Uint8Array(await page.arrayBuffer());
    const type = page.type.toLowerCase();

    let embedded;
    if (type.includes("png")) {
      embedded = await pdf.embedPng(bytes);
    } else if (type.includes("jpeg") || type.includes("jpg")) {
      embedded = await pdf.embedJpg(bytes);
    } else {
      // Try JPEG first, then PNG (covers camera blobs without a precise type).
      try {
        embedded = await pdf.embedJpg(bytes);
      } catch {
        embedded = await pdf.embedPng(bytes);
      }
    }

    const { width, height } = embedded.scale(1);
    const pdfPage = pdf.addPage([width, height]);
    pdfPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const pdfBytes = await pdf.save();
  const safeName = fileName.trim().replace(/\.pdf$/i, "") || "Scan";
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  return new File([buffer], `${safeName}.pdf`, {
    type: "application/pdf",
  });
}

export { MAX_PAGES };
