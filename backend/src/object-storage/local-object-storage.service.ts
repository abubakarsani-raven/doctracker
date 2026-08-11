import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { ObjectStorageService } from './object-storage.interface';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

@Injectable()
export class LocalObjectStorageService extends ObjectStorageService {
  private readonly logger = new Logger(LocalObjectStorageService.name);
  private readonly uploadsPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    super();
    
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:4003');
    
    // Ensure uploads directory exists
    this.ensureUploadsDirectory();
    
    this.logger.log(`Initialized local storage at: ${this.uploadsPath}`);
  }

  private async ensureUploadsDirectory(): Promise<void> {
    try {
      await access(this.uploadsPath);
    } catch {
      // Directory doesn't exist, create it
      await mkdir(this.uploadsPath, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsPath}`);
    }
  }

  /** Resolve key under uploads root; reject path traversal. */
  private resolveSafePath(key: string): string {
    if (!key || key.includes('\0')) {
      throw new Error('Invalid storage key');
    }
    const normalizedKey = key.replace(/^[/\\]+/, '');
    const resolvedRoot = path.resolve(this.uploadsPath);
    const filePath = path.resolve(resolvedRoot, normalizedKey);
    const rootWithSep = resolvedRoot.endsWith(path.sep)
      ? resolvedRoot
      : resolvedRoot + path.sep;
    if (filePath !== resolvedRoot && !filePath.startsWith(rootWithSep)) {
      throw new Error('Invalid storage key: path escapes uploads directory');
    }
    return filePath;
  }

  async put(key: string, body: Buffer | Uint8Array | string | Readable, contentType?: string): Promise<string> {
    try {
      const filePath = this.resolveSafePath(key);
      const dir = path.dirname(filePath);
      
      // Ensure directory exists
      await mkdir(dir, { recursive: true });

      if (body instanceof Readable) {
        // Handle streams
        await this.streamToFile(body, filePath);
      } else {
        // Handle buffers, arrays, and strings
        await writeFile(filePath, body);
      }

      this.logger.debug(`Successfully saved file locally: ${key}`);
      return key.replace(/^[/\\]+/, '');
    } catch (error) {
      this.logger.error(`Failed to save file ${key}:`, error);
      throw new Error(`Failed to save file locally: ${error.message}`);
    }
  }

  private streamToFile(stream: Readable, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      
      stream.pipe(writeStream);
      
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  async getStream(key: string): Promise<Readable> {
    try {
      const filePath = this.resolveSafePath(key);
      
      // Check if file exists
      await access(filePath);
      
      const stream = fs.createReadStream(filePath);
      return stream;
    } catch (error) {
      this.logger.error(`Failed to get file ${key}:`, error);
      throw new Error(`Failed to retrieve file: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(key);
      await unlink(filePath);
      this.logger.debug(`Successfully deleted file: ${key}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, that's okay
        this.logger.debug(`File ${key} doesn't exist, nothing to delete`);
        return;
      }
      this.logger.error(`Failed to delete file ${key}:`, error);
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
      const filePath = this.resolveSafePath(key);
      const stats = await stat(filePath);
      
      return {
        contentLength: stats.size,
        contentType: this.getContentTypeFromExtension(key),
        lastModified: stats.mtime,
        etag: `"${stats.size}-${stats.mtime.getTime()}"`, // Simple ETag simulation
      };
    } catch (error) {
      this.logger.error(`Failed to get file stats ${key}:`, error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // For local storage, we'll generate a simple URL
      // In production, you might want to implement proper signed URLs with JWT or similar
      const timestamp = Date.now() + (expiresIn * 1000);
      const signedUrl = `${this.baseUrl}/api/files/download/${key}?expires=${timestamp}`;
      
      this.logger.debug(`Generated local signed URL for: ${key}, expires in ${expiresIn} seconds`);
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  private getContentTypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}