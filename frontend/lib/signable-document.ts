/**
 * Which documents can actually carry a signature.
 *
 * Mirrors `isSignableFile` in backend/src/signatures/signatures.service.ts.
 * Only PDFs (stamped with pdf-lib) and rich-text documents (image injected
 * into the HTML) have a stamping path. Everything else — DOCX above all —
 * cannot be signed: the placement preview has no PDF to render, and the
 * backend now rejects the request rather than recording a signature against
 * an untouched file.
 */

export interface SignableDocument {
  /** Extension or MIME type as stored on the file record. */
  fileType?: string | null;
  /** Alternative field name used by the documents list/detail mappers. */
  type?: string | null;
  fileName?: string | null;
  name?: string | null;
  isRichText?: boolean | null;
}

export const UNSUPPORTED_SIGNATURE_TYPE_MESSAGE =
  "Only PDF and rich-text documents can be signed. Convert this file to PDF and upload it as a new version, then request signatures on that.";

function typeOf(doc: SignableDocument): string {
  return (doc.fileType || doc.type || "").toLowerCase();
}

function nameOf(doc: SignableDocument): string {
  return (doc.fileName || doc.name || "").toLowerCase();
}

export function isPdfDocument(doc: SignableDocument): boolean {
  const type = typeOf(doc);
  return (
    type === "pdf" || type === "application/pdf" || nameOf(doc).endsWith(".pdf")
  );
}

export function isRichTextDocument(doc: SignableDocument): boolean {
  const type = typeOf(doc);
  return Boolean(doc.isRichText) || type === "html" || type === "text/html";
}

export function isSignableDocument(doc: SignableDocument): boolean {
  return isPdfDocument(doc) || isRichTextDocument(doc);
}

/** Short label for the blocked-state UI, e.g. "DOCX documents". */
export function documentTypeLabel(doc: SignableDocument): string {
  const type = typeOf(doc);
  const fromName = nameOf(doc).split(".").pop();
  const ext = (type.includes("/") ? fromName : type) || fromName || "";
  return ext ? `${ext.toUpperCase()} documents` : "Documents of this type";
}
