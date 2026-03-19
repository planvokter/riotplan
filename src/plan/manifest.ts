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
 * Read optional metadata fields from the plan.yaml stored inside a .plan SQLite file.
 *
 * Tolerant parser: if plan.yaml is missing or invalid, returns an empty object.
 */
export async function readPlanManifestMetadata(planPath: string): Promise<PlanManifestMetadata> {
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
