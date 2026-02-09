/**
 * Reflection File Writer
 *
 * Writes step reflection files to the reflections/ directory within a plan.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Write a step reflection to the reflections/ directory
 *
 * @param planPath - Path to the plan directory
 * @param stepNumber - Step number to reflect on
 * @param content - Reflection content (freeform prose)
 * @returns Path to the written reflection file
 */
export async function writeStepReflection(
    planPath: string,
    stepNumber: number,
    content: string
): Promise<string> {
    // Ensure reflections directory exists
    const reflectionsDir = join(planPath, 'reflections');
    if (!existsSync(reflectionsDir)) {
        await mkdir(reflectionsDir, { recursive: true });
    }

    // Format step number with leading zero (e.g., 01, 02, ...)
    const stepNum = String(stepNumber).padStart(2, '0');
    const filename = `${stepNum}-reflection.md`;
    const filepath = join(reflectionsDir, filename);

    // Write the reflection file (freeform prose, no schema)
    await writeFile(filepath, content, 'utf-8');

    return filepath;
}
