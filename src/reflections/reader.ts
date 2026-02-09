/**
 * Reflection File Reader
 *
 * Reads step reflection files from the reflections/ directory within a plan.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface StepReflection {
    step: number;
    content: string;
}

/**
 * Read a single step reflection
 *
 * @param planPath - Path to the plan directory
 * @param stepNumber - Step number to read reflection for
 * @returns Reflection content or null if not found
 */
export async function readStepReflection(
    planPath: string,
    stepNumber: number
): Promise<string | null> {
    const stepNum = String(stepNumber).padStart(2, '0');
    const filename = `${stepNum}-reflection.md`;
    const filepath = join(planPath, 'reflections', filename);

    if (!existsSync(filepath)) {
        return null;
    }

    try {
        const content = await readFile(filepath, 'utf-8');
        return content;
    } catch {
        // Gracefully handle read errors
        return null;
    }
}

/**
 * Read all step reflections in the plan
 *
 * @param planPath - Path to the plan directory
 * @returns Array of step reflections sorted by step number
 */
export async function readAllReflections(
    planPath: string
): Promise<StepReflection[]> {
    const reflectionsDir = join(planPath, 'reflections');

    if (!existsSync(reflectionsDir)) {
        return [];
    }

    try {
        const files = await readdir(reflectionsDir);
        const reflectionFiles = files.filter(f => f.match(/^\d{2}-reflection\.md$/));

        const reflections: StepReflection[] = [];

        for (const file of reflectionFiles) {
            const stepNum = parseInt(file.substring(0, 2), 10);
            const content = await readFile(join(reflectionsDir, file), 'utf-8');
            reflections.push({ step: stepNum, content });
        }

        // Sort by step number
        reflections.sort((a, b) => a.step - b.step);

        return reflections;
    } catch {
        // Gracefully handle errors
        return [];
    }
}

/**
 * Read reflections for steps prior to a given step number
 *
 * @param planPath - Path to the plan directory
 * @param beforeStep - Only return reflections for steps before this number
 * @returns Array of step reflections for prior steps
 */
export async function readPriorReflections(
    planPath: string,
    beforeStep: number
): Promise<StepReflection[]> {
    const allReflections = await readAllReflections(planPath);
    return allReflections.filter(r => r.step < beforeStep);
}
