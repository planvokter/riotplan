import type { Analysis } from "./types.js";
/**
 * Load an analysis from a .plan SQLite file
 */
export declare function loadAnalysis(planPath: string): Promise<Analysis | null>;
/**
 * Check if a plan has an analysis
 */
export declare function hasAnalysis(planPath: string): Promise<boolean>;
//# sourceMappingURL=loader.d.ts.map