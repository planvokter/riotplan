/**
 * Reflection File Reader
 *
 * Reads step reflection files from SQLite .plan storage.
 */
export interface StepReflection {
    step: number;
    content: string;
}
/**
 * Read a single step reflection from the plan's SQLite database.
 */
export declare function readStepReflection(planPath: string, stepNumber: number): Promise<string | null>;
/**
 * Read all step reflections from the plan's SQLite database.
 */
export declare function readAllReflections(planPath: string): Promise<StepReflection[]>;
/**
 * Read reflections for steps prior to a given step number.
 */
export declare function readPriorReflections(planPath: string, beforeStep: number): Promise<StepReflection[]>;
//# sourceMappingURL=reader.d.ts.map