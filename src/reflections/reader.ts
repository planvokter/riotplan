/**
 * Reflection File Reader
 *
 * Reads step reflection files from SQLite .plan storage.
 */

import { createSqliteProvider } from '@kjerneverk/riotplan-format';

export interface StepReflection {
    step: number;
    content: string;
}

/**
 * Read a single step reflection from the plan's SQLite database.
 */
export async function readStepReflection(
    planPath: string,
    stepNumber: number
): Promise<string | null> {
    const provider = createSqliteProvider(planPath);
    try {
        const filesResult = await provider.getFiles();
        if (!filesResult.success || !filesResult.data) {
            return null;
        }
        const stepNum = String(stepNumber).padStart(2, '0');
        const filename = `reflections/${stepNum}-reflection.md`;
        const match = filesResult.data.find((file) => file.filename === filename);
        return match?.content ?? null;
    } finally {
        await provider.close();
    }
}

/**
 * Read all step reflections from the plan's SQLite database.
 */
export async function readAllReflections(
    planPath: string
): Promise<StepReflection[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const filesResult = await provider.getFiles();
        if (!filesResult.success || !filesResult.data) {
            return [];
        }

        return filesResult.data
            .filter((file) => /^reflections\/\d{2}-reflection\.md$/.test(file.filename))
            .map((file) => ({
                step: parseInt(file.filename.match(/(\d{2})-reflection\.md$/)?.[1] || '0', 10),
                content: file.content,
            }))
            .filter((item) => item.step > 0)
            .sort((a, b) => a.step - b.step);
    } finally {
        await provider.close();
    }
}

/**
 * Read reflections for steps prior to a given step number.
 */
export async function readPriorReflections(
    planPath: string,
    beforeStep: number
): Promise<StepReflection[]> {
    const allReflections = await readAllReflections(planPath);
    return allReflections.filter(r => r.step < beforeStep);
}
