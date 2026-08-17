/**
 * Which files can actually carry a signature.
 *
 * Mirrored on the client by frontend/lib/signable-document.ts — keep the two
 * in step. Kept free of Nest/Prisma imports so it stays cheap to unit-test.
 */

/** The parts of a file row needed to decide how (or whether) it can be stamped. */
export interface SignableFile {
  fileType?: string | null;
  fileName?: string | null;
  richTextDoc?: unknown;
}

export function isPdfFile(file: SignableFile): boolean {
  return (
    file.fileType === 'pdf' ||
    file.fileType === 'application/pdf' ||
    Boolean(file.fileName?.toLowerCase().endsWith('.pdf'))
  );
}

export function isRichTextFile(file: SignableFile): boolean {
  return (
    Boolean(file.richTextDoc) ||
    file.fileType === 'html' ||
    file.fileType === 'text/html'
  );
}

/**
 * Only PDFs and rich-text documents can actually carry a stamp: PDFs are
 * edited with pdf-lib, rich text by injecting the image into the HTML. Every
 * other type (DOCX above all) has no stamping path, and used to fall through
 * to a metadata-only "signature" — the request was marked signed while the
 * document itself came away unchanged. Refuse those up front instead.
 */
export function isSignableFile(file: SignableFile): boolean {
  return isPdfFile(file) || isRichTextFile(file);
}

export const UNSUPPORTED_SIGNATURE_TYPE_MESSAGE =
  'Only PDF and rich-text documents can be signed. Convert this file to PDF and upload it as a new version, then request signatures on that.';
