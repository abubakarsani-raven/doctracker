import { BadRequestException } from '@nestjs/common';

/**
 * Allowed file extensions and their corresponding MIME types for upload.
 * This serves as a security allowlist to prevent malicious file uploads.
 */
export const UPLOAD_ALLOWLIST = {
  // Document types
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
  
  // Image types
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
} as const;

/**
 * Get all allowed file extensions as an array
 */
export const ALLOWED_EXTENSIONS = Object.keys(UPLOAD_ALLOWLIST);

/**
 * Get all allowed MIME types as an array
 */
export const ALLOWED_MIME_TYPES = Object.values(UPLOAD_ALLOWLIST).flat();

/**
 * Validates if a file upload is allowed based on filename and MIME type.
 * Throws BadRequestException if the file is not allowed.
 * 
 * @param originalname - The original filename from the upload
 * @param mimetype - The MIME type detected by multer
 * @throws BadRequestException if file type is not allowed
 */
export function assertAllowedUpload(originalname: string, mimetype: string): void {
  if (!originalname || !mimetype) {
    throw new BadRequestException('File name and MIME type are required');
  }

  // Extract extension from filename (case-insensitive)
  const extension = originalname.toLowerCase().match(/\.[^.]*$/)?.[0];
  
  if (!extension) {
    throw new BadRequestException('File must have an extension');
  }

  // Check if extension is allowed
  const allowedMimeTypes = UPLOAD_ALLOWLIST[extension as keyof typeof UPLOAD_ALLOWLIST] as readonly string[] | undefined;
  if (!allowedMimeTypes) {
    throw new BadRequestException(
      `File type "${extension}" is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Check if MIME type matches the extension
  if (!allowedMimeTypes.includes(mimetype)) {
    throw new BadRequestException(
      `MIME type "${mimetype}" does not match expected types for "${extension}": ${allowedMimeTypes.join(', ')}`
    );
  }
}

/**
 * Check if a file type is allowed without throwing an exception
 * 
 * @param originalname - The original filename
 * @param mimetype - The MIME type
 * @returns true if allowed, false otherwise
 */
export function isUploadAllowed(originalname: string, mimetype: string): boolean {
  try {
    assertAllowedUpload(originalname, mimetype);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a browser-usable Content-Type for downloads / previews.
 * Prefers a real MIME from storage, then filename / stored fileType.
 */
export function resolveDownloadContentType(options: {
  storageContentType?: string | null;
  fileName?: string | null;
  fileType?: string | null;
}): string {
  const stored = options.storageContentType?.split(';')[0]?.trim();
  if (stored && stored !== 'application/octet-stream' && stored.includes('/')) {
    return stored;
  }

  const fromName = options.fileName?.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (fromName) {
    const allowed =
      UPLOAD_ALLOWLIST[fromName as keyof typeof UPLOAD_ALLOWLIST];
    if (allowed?.[0]) return allowed[0];
  }

  const rawType = (options.fileType || '').toLowerCase().replace(/^\./, '');
  if (rawType.includes('/')) return rawType;
  if (rawType) {
    const allowed =
      UPLOAD_ALLOWLIST[`.${rawType}` as keyof typeof UPLOAD_ALLOWLIST];
    if (allowed?.[0]) return allowed[0];
  }

  return stored || 'application/octet-stream';
}