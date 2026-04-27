export type DocumentType = 'transcript' | 'note' | 'artifact';
export type DocumentVisibility = 'private' | 'project'; // 'org' | 'public' future

export interface Document {
  /** Unique document identifier */
  id: string;
  /** User who created the document */
  ownerId: string;
  /** Optional project scope — required when visibility is 'project' */
  projectId?: string;
  /** Access visibility; 'private' = ownerId only, 'project' = any member of projectId */
  visibility: DocumentVisibility;
  /** Content category */
  type: DocumentType;
  /** Human-readable document name */
  title: string;
  /** Optional description */
  description?: string;
  /** Path to the document object within the configured storage bucket (no bucket name) */
  path: string;
  /** MIME type of the content stored at gcsPath */
  mimeType: string;
  /** Additional key-value attributes (tags, source refs, etc.) */
  attributes: Record<string, unknown>;
  /** Schema version for future migrations */
  schemaVersion: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

export type DocumentCreate = Omit<Document, 'id' | 'createdAt' | 'updatedAt'>;
