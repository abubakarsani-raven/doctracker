import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ObjectStorageService } from './object-storage.interface';

@Injectable()
export class R2ObjectStorageService extends ObjectStorageService {
  private readonly logger = new Logger(R2ObjectStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    super();
    
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || 
                       this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || 
                           this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('S3_REGION', 'auto');
    
    this.bucketName = this.configService.get<string>('R2_BUCKET') || 
                     this.configService.get<string>('S3_BUCKET');

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error('R2/S3 configuration is incomplete. Required: ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET');
    }

    // Determine endpoint based on whether we're using R2 or standard S3
    let endpoint: string;
    if (accountId) {
      // Cloudflare R2
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    } else if (this.configService.get<string>('S3_ENDPOINT')) {
      // Custom S3-compatible endpoint
      endpoint = this.configService.get<string>('S3_ENDPOINT');
    } else {
      // Standard AWS S3 (no custom endpoint needed)
      endpoint = undefined;
    }

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // R2 requires path-style addressing
      forcePathStyle: !!accountId,
    });

    this.logger.log(`Initialized R2/S3 storage with bucket: ${this.bucketName}`);
  }

  async put(key: string, body: Buffer | Uint8Array | string | Readable, contentType?: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.debug(`Successfully uploaded object: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload object ${key}:`, error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async getStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No body in response');
      }

      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get object ${key}:`, error);
      throw new Error(`Failed to retrieve file: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.debug(`Successfully deleted object: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${key}:`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async head(key: string): Promise<{
    contentLength?: number;
    contentType?: string;
    lastModified?: Date;
    etag?: string;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error(`Failed to head object ${key}:`, error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.debug(`Generated signed URL for object: ${key}, expires in ${expiresIn} seconds`);
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for object ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }
}