import type { Document, DocumentCreate, DocumentType } from '../types/document.js';
import type { AccessContext } from '../types/access-context.js';

export interface IDocumentRepository {
  get(id: string): Promise<Document | null>;

  listAccessible(
    context: AccessContext,
    opts?: { type?: DocumentType; limit?: number },
  ): Promise<Document[]>;

  create(doc: DocumentCreate): Promise<Document>;

  update(
    id: string,
    updates: Partial<Pick<Document, 'title' | 'description' | 'path' | 'mimeType' | 'attributes' | 'projectId' | 'visibility'>>,
  ): Promise<Document>;

  delete(id: string): Promise<void>;
}
