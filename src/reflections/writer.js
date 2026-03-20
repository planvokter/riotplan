/**
 * Reflection File Writer
 *
 * Writes step reflection files to SQLite .plan storage.
 */
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
function reflectionFilename(stepNumber) {
    const stepNum = String(stepNumber).padStart(2, '0');
    return `reflections/${stepNum}-reflection.md`;
}
/**
 * Write a step reflection to the plan's SQLite database.
 */
export async function writeStepReflection(planPath, stepNumber, content) {
    const filename = reflectionFilename(stepNumber);
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
    }
    finally {
        await provider.close();
    }
}
//# sourceMappingURL=writer.js.map