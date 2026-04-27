// TODO: Define the IPlanRepository interface for plan persistence.
// This is a future stub — the shape will be defined when plan
// storage is implemented.
import type { PlanRef } from '../types/plan.js';

export interface IPlanRepository {
  get(id: string): Promise<PlanRef | null>;
  // TODO: Add plan-specific query and mutation methods
}
