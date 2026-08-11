import { Readable } from 'stream';

export abstract class ObjectStorageService {
  /**
   * Store an object with the given key
   * @param key - Unique identifier for the object
   * @param body - File data (Buffer, Uint8Array, string, or stream)
   * @param contentType - MIME type of the file
   * @returns Promise resolving to the key or URL of the stored object
   */
  abstract put(
    key: string, 
    body: Buffer | Uint8Array | string | Readable, 
    contentType?: string
  ): Promise<string>;

  /**
   * Retrieve an object as a stream
   * @param key - Unique identifier for the object
   * @returns Promise resolving to a readable stream
   */
  abstract getStream(key: string): Promise<Readable>;

  /**
   * Delete an object
   * @param key - Unique identifier for the object
   * @returns Promise resolving when deletion is complete
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Get metadata about an object without downloading it
   * @param key - Unique identifier for the object
   * @returns Promise resolving to object metadata
   */
  abstract head(key: string): Promise<{
    contentLength?: number;
    contentType?: string;
    lastModified?: Date;
    etag?: string;
  }>;

  /**
   * Generate a signed URL for temporary access to an object
   * @param key - Unique identifier for the object
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @returns Promise resolving to a signed URL
   */
  abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}