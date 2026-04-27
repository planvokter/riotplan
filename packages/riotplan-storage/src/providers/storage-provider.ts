import type { StorageObject } from '../types/storage-object.js';
import type { StorageWriteOptions, StorageSignedUrlOptions } from '../types/storage-options.js';

export interface IStorageProvider {
  /**
   * Read the full content of an object into a Buffer.
   * Throws if the object does not exist.
   */
  read(path: string): Promise<Buffer>;

  /**
   * Write content to an object path, creating or replacing it.
   */
  write(path: string, content: Buffer | string, options?: StorageWriteOptions): Promise<void>;

  /**
   * Return true if an object exists at the given path.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete an object. By default does not throw if the object is absent.
   */
  delete(path: string, options?: { ignoreNotFound?: boolean }): Promise<void>;

  /**
   * Return metadata for an object without downloading its content.
   * Returns null if the object does not exist.
   */
  stat(path: string): Promise<StorageObject | null>;

  /**
   * List all objects whose path starts with the given prefix.
   * If prefix is omitted, lists all objects in the bucket.
   */
  list(prefix?: string): Promise<StorageObject[]>;

  /**
   * Generate a time-limited signed URL for direct client access to an object.
   */
  signedUrl(path: string, options: StorageSignedUrlOptions): Promise<string>;
}
