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

  async getStream(key: string): Promise<Readable> {
    const url = await this.getSignedUrl(key, 600);
    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} fetching ${key}`);
      }
      return Readable.fromWeb(response.body as any);
    } catch (error: any) {
      this.logger.error(`Cloudinary download failed for ${key}:`, error);
      throw new Error(`Failed to retrieve file from Cloudinary: ${error.message}`);
    }
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
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    try {
      return cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true,
        sign_url: true,
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
