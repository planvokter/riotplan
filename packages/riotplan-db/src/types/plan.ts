export type PlanStatus = 'active' | 'done' | 'hold';
export type PlanVisibility = 'private' | 'project'; // 'org' | 'public' future

export interface Plan {
  /** Unique plan identifier */
  id: string;
  /** User who created the plan */
  ownerId: string;
  /** Optional project scope — required when visibility is 'project' */
  projectId?: string;
  /** Access visibility; 'private' = ownerId only, 'project' = any member of projectId */
  visibility: PlanVisibility;
  /** Lifecycle status */
  status: PlanStatus;
  /** Human-readable plan name */
  title: string;
  /** Optional description */
  description?: string;
  /** Additional key-value attributes (tags, source refs, etc.) */
  attributes: Record<string, unknown>;
  /** Schema version for future migrations */
  schemaVersion: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

export type PlanCreate = Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>;
