/**
 * History Manager
 *
 * Manage plan history storage via SQLite .plan files.
 */
import type { PlanHistory } from "../types.js";
export interface HistoryManager {
    history: PlanHistory;
    path: string;
    save(): Promise<void>;
    reload(): Promise<void>;
}
export declare function initHistory(initialVersion?: string): PlanHistory;
export declare function loadHistory(planPath: string): Promise<HistoryManager>;
export declare function saveHistory(history: PlanHistory, planPath: string): Promise<void>;
//# sourceMappingURL=manager.d.ts.map