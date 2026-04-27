import type { Plan, PlanCreate, PlanStatus } from '../types/plan.js';
import type { AccessContext } from '../types/access-context.js';

export interface IPlanRepository {
  get(id: string): Promise<Plan | null>;

  listAccessible(
    context: AccessContext,
    opts?: { status?: PlanStatus; limit?: number },
  ): Promise<Plan[]>;

  create(plan: PlanCreate): Promise<Plan>;

  update(
    id: string,
    updates: Partial<Pick<Plan, 'title' | 'description' | 'status' | 'attributes' | 'projectId' | 'visibility'>>,
  ): Promise<Plan>;

  delete(id: string): Promise<void>;
}
