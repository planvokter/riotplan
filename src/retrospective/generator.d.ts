/**
 * Retrospective Generator
 *
 * Generates plan retrospectives by analyzing execution data from SQLite .plan files.
 */
import type { Plan } from '../types.js';
export interface GenerateRetrospectiveOptions {
    provider?: string;
    model?: string;
    force?: boolean;
}
export interface RetrospectiveContext {
    plan: Plan;
    reflections: Array<{
        step: number;
        content: string;
    }>;
    summary?: string;
    executionPlan?: string;
    status?: string;
    stepFiles: Array<{
        number: number;
        title: string;
        content: string;
    }>;
}
/**
 * Load all context needed for retrospective generation from SQLite.
 */
export declare function loadRetrospectiveContext(planPath: string): Promise<RetrospectiveContext>;
export declare function formatRetrospectivePrompt(context: RetrospectiveContext): string;
export declare function generateRetrospective(planPath: string, options?: GenerateRetrospectiveOptions): Promise<{
    context: RetrospectiveContext;
    prompt: string;
}>;
//# sourceMappingURL=generator.d.ts.map