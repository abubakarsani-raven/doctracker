import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { ObjectStorageService } from './object-storage.interface';

/**
 * Cloudinary-backed object storage for production document binaries.
 * Uses resource_type "raw" so PDFs/Office files are stored as-is (not image-transformed).
 */
@Injectable()
export class CloudinaryObjectStorageService extends ObjectStorageService {
  private readonly logger = new Logger(CloudinaryObjectStorageService.name);
  private readonly folderPrefix: string;

  constructor(private configService: ConfigService) {
    super();

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary configuration incomplete. Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.folderPrefix = (
      this.configService.get<string>('CLOUDINARY_FOLDER') || 'doctracker'
    ).replace(/\/+$/, '');

    this.logger.log(
      `Initialized Cloudinary storage (cloud: ${cloudName}, folder: ${this.folderPrefix})`,
    );
  }

  /** Map our storage key → Cloudinary public_id (keep extension for raw assets). */
  private toPublicId(key: string): string {
    const cleaned = key.replace(/^\/+/, '');
    return `${this.folderPrefix}/${cleaned}`;
  }

  private extensionOf(key: string): string | undefined {
    const match = key.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase();
  }

  async put(
    key: string,
    body: Buffer | Uint8Array | string | Readable,
    contentType?: string,
  ): Promise<string> {
    const publicId = this.toPublicId(key);
    const buffer = await this.toBuffer(body);

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            public_id: publicId,
            overwrite: true,
            invalidate: true,
          },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              reject(error || new Error('Cloudinary upload returned no result'));
              return;
            }
            resolve(uploadResult);
          },
        );
        stream.end(buffer);
      });

      this.logger.debug(`Uploaded to Cloudinary: ${result.public_id}`);
      // Persist our logical key so local/R2 paths stay interchangeable in DB.
      return key;
    } catch (error: any) {
      this.logger.error(`Cloudinary upload failed for ${key}:`, error);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  /**
   * Fetch raw bytes for streaming to clients.
   *
   * Production accounts often enable Restricted media types for `raw`, which
   * makes unsigned delivery URLs return 401. We therefore:
   *  1. Resolve the resource via the Admin API (authoritative public_id/version)
   *  2. Try a correctly signed delivery URL (no invalid `expires_at` on url())
   *  3. Fall back to `private_download_url` (time-limited authenticated download)
   */
  async getStream(key: string): Promise<Readable> {
    const publicId = this.toPublicId(key);
    const candidates: string[] = [];

    let version: number | string | undefined;
    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: 'raw',
      });
      version = resource.version;
      if (resource.secure_url) candidates.push(resource.secure_url);
      if (resource.url) candidates.push(resource.url);
    } catch (error: any) {
      this.logger.warn(
        `Cloudinary admin lookup failed for ${publicId}: ${error?.message || error}`,
      );
    }

    candidates.push(
      cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true,
        sign_url: true,
        ...(version ? { version } : {}),
      }),
    );

    // Unsigned — works when Restricted media types is off.
    candidates.push(
      cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true,
        ...(version ? { version } : {}),
      }),
    );

    const format = this.extensionOf(key);
    const publicIdNoExt = format
      ? publicId.replace(new RegExp(`\\.${format}$`, 'i'), '')
      : publicId;
    try {
      candidates.push(
        cloudinary.utils.private_download_url(publicIdNoExt, format || '', {
          resource_type: 'raw',
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 600,
        }),
      );
      // Some raw assets keep the extension inside public_id.
      candidates.push(
        cloudinary.utils.private_download_url(publicId, format || '', {
          resource_type: 'raw',
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 600,
        }),
      );
    } catch (error: any) {
      this.logger.warn(
        `Could not build private_download_url for ${publicId}: ${error?.message || error}`,
      );
    }

    const unique = [...new Set(candidates.filter(Boolean))];
    let lastStatus = 0;
    let lastError: unknown;

    for (const url of unique) {
      try {
        const response = await fetch(url, { redirect: 'follow' });
        if (response.ok && response.body) {
          return Readable.fromWeb(response.body as any);
        }
        lastStatus = response.status;
        this.logger.debug(
          `Cloudinary candidate returned HTTP ${response.status} for ${publicId}`,
        );
      } catch (error) {
        lastError = error;
      }
    }

    this.logger.error(
      `Cloudinary download failed for ${key}: HTTP ${lastStatus || 'n/a'}`,
      lastError as any,
    );
    throw new Error(
      `Failed to retrieve file from Cloudinary: HTTP ${lastStatus || 'error'} fetching ${key}`,
    );
  }

  async delete(key: string): Promise<void> {
    const publicId = this.toPublicId(key);
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
        invalidate: true,
      });
      this.logger.debug(`Deleted from Cloudinary: ${publicId}`);
    } catch (error: any) {
      this.logger.error(`Cloudinary delete failed for ${key}:`, error);
      throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
  }

  async head(key: string): Promise<{
    contentLength?: number;
    contentType?: string;
    lastModified?: Date;
    etag?: string;
  }> {
    const publicId = this.toPublicId(key);
    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: 'raw',
      });
      return {
        contentLength: resource.bytes,
        contentType: resource.format
          ? this.mimeFromFormat(resource.format)
          : 'application/octet-stream',
        lastModified: resource.created_at
          ? new Date(resource.created_at)
          : undefined,
        etag: resource.etag || resource.version?.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Cloudinary head failed for ${key}:`, error);
      throw new Error(`Failed to get Cloudinary file metadata: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const publicId = this.toPublicId(key);
    const format = this.extensionOf(key);
    const publicIdNoExt = format
      ? publicId.replace(new RegExp(`\\.${format}$`, 'i'), '')
      : publicId;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    try {
      // Prefer the authenticated download helper — `expires_at` on cloudinary.url()
      // is not a valid delivery-signature option and produced HTTP 401 in production.
      return cloudinary.utils.private_download_url(publicIdNoExt, format || '', {
        resource_type: 'raw',
        type: 'upload',
        expires_at: expiresAt,
      });
    } catch (error: any) {
      this.logger.error(`Failed to generate Cloudinary URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  private mimeFromFormat(format: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      csv: 'text/csv',
      html: 'text/html',
    };
    return map[format.toLowerCase()] || 'application/octet-stream';
  }

  private async toBuffer(
    body: Buffer | Uint8Array | string | Readable,
  ): Promise<Buffer> {
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (typeof body === 'string') return Buffer.from(body);
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
