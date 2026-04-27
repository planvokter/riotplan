/** Options for writing an object. */
export interface StorageWriteOptions {
  /** MIME type to store with the object. */
  contentType?: string;
  /** Arbitrary key-value metadata to store alongside the object. */
  metadata?: Record<string, string>;
}

export type StorageSignedUrlAction = 'read' | 'write';

/** Options for generating a signed/presigned URL. */
export interface StorageSignedUrlOptions {
  action: StorageSignedUrlAction;
  /** How long the URL should remain valid, in seconds. */
  expiresInSeconds: number;
  /** Content type to enforce for write-action URLs. */
  contentType?: string;
}
