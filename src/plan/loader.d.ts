/**
 * Plan Loader Module
 *
 * Loads plans from SQLite .plan files into Plan data structures.
 */
import type { Plan } from "../types.js";
/**
 * Options for loading a plan
 */
export interface LoadPlanOptions {
    /** Parse STATUS.md for state (default: true) */
    parseStatus?: boolean;
}
/**
 * Load a plan from a .plan SQLite file
 *
 * @param path - Path to the .plan file
 * @param options - Loading options
 * @returns The loaded plan
 */
export declare function loadPlan(path: string, options?: LoadPlanOptions): Promise<Plan>;
//# sourceMappingURL=loader.d.ts.map