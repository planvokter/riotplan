export interface AccessContext {
  userId: string;
  projectIds?: string[];
  orgId?: string; // future: org-level rollup
}
