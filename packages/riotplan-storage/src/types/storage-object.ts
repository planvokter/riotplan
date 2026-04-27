/** Metadata about a stored object — no content. */
export interface StorageObject {
  /** Object path within the bucket (no bucket name). */
  path: string;
  /** Size in bytes, if known. */
  size?: number;
  /** MIME/content type, if known. */
  contentType?: string;
  /** ETag or generation identifier for change detection. */
  etag?: string;
  /** MD5 hash (base64-encoded), if provided by the backend. */
  md5?: string;
  /** Last-modified timestamp. */
  updatedAt?: Date;
}
