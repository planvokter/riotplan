// TODO: Define the INoteRepository interface for note persistence.
// This is a future stub — the shape will be defined when note
// storage is implemented.
import type { Note } from '../types/note.js';

export interface INoteRepository {
  get(id: string): Promise<Note | null>;
  // TODO: Add note-specific query and mutation methods
}
