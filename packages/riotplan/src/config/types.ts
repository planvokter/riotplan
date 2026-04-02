/**
 * Configuration Type Definitions for RiotPlan
 *
 * This module re-exports TypeScript types for RiotPlan configuration.
 * The actual type is inferred from the Zod schema in schema.ts to ensure
 * consistency between validation and type checking.
 */

// Re-export the type from schema.ts (source of truth)
export type { RiotPlanConfig } from './schema.js';
