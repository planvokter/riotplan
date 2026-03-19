/**
 * Reflection File Writer
 *
 * Writes step reflection files to SQLite (.plan) or the reflections/ directory.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

/**
 * Format a step number as a zero-padded reflection filename.
 */
function reflectionFilename(stepNumber: number): string {
    const stepNum = String(stepNumber).padStart(2, '0');
    return `reflections/${stepNum}-reflection.md`;
}

/**
 * Write a step reflection.
 *
 * For SQLite-backed plans (.plan files) the content is persisted via the
 * storage provider. For directory-backed plans it is written to the
 * reflections/ sub-directory on disk.
 *
 * @param planPath - Path to the plan directory or .plan file
 * @param stepNumber - Step number to reflect on
 * @param content - Reflection content (freeform prose)
 * @returns The logical filename of the written reflection
 */
export async function writeStepReflection(
    planPath: string,
    stepNumber: number,
    content: string
): Promise<string> {
    const filename = reflectionFilename(stepNumber);

    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        try {
            const now = new Date().toISOString();
            const result = await provider.saveFile({
                type: 'reflection',
                filename,
                content,
                createdAt: now,
                updatedAt: now,
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to save reflection');
            }
            return filename;
        } finally {
            await provider.close();
        }
    }

    const reflectionsDir = join(planPath, 'reflections');
    if (!existsSync(reflectionsDir)) {
        await mkdir(reflectionsDir, { recursive: true });
    }

    const filepath = join(planPath, filename);
    await writeFile(filepath, content, 'utf-8');

    return filepath;
}
