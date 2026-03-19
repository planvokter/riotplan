import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

const PlanManifestMetadataSchema = z
    .object({
        projectPath: z.string().min(1).optional(),
    })
    .passthrough();

export type PlanManifestMetadata = z.infer<typeof PlanManifestMetadataSchema>;

/**
 * Reads optional metadata fields from plan.yaml (directory plans) or
 * from the SQLite provider metadata (.plan files).
 *
 * This is a tolerant parser: if plan.yaml is missing or invalid, we return
 * an empty object to preserve backward compatibility with older plans.
 */
export async function readPlanManifestMetadata(planPath: string): Promise<PlanManifestMetadata> {
    if (planPath.endsWith('.plan')) {
        return readManifestFromSqlite(planPath);
    }

    try {
        const manifestPath = join(planPath, 'plan.yaml');
        const content = await readFile(manifestPath, 'utf-8');
        const parsed = parseYaml(content);
        const result = PlanManifestMetadataSchema.safeParse(parsed);
        return result.success ? result.data : {};
    } catch {
        return {};
    }
}

async function readManifestFromSqlite(planPath: string): Promise<PlanManifestMetadata> {
    try {
        const provider = createSqliteProvider(planPath);
        try {
            const result = await provider.getFile('other', 'plan.yaml');
            if (!result.success || !result.data) {
                return {};
            }
            const parsed = parseYaml(result.data.content);
            const validated = PlanManifestMetadataSchema.safeParse(parsed);
            return validated.success ? validated.data : {};
        } finally {
            await provider.close();
        }
    } catch {
        return {};
    }
}
