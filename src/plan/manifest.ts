import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

const PlanManifestMetadataSchema = z
    .object({
        projectPath: z.string().min(1).optional(),
    })
    .passthrough();

export type PlanManifestMetadata = z.infer<typeof PlanManifestMetadataSchema>;

/**
 * Reads optional metadata fields from plan.yaml.
 *
 * This is a tolerant parser: if plan.yaml is missing or invalid, we return
 * an empty object to preserve backward compatibility with older plans.
 */
export async function readPlanManifestMetadata(planPath: string): Promise<PlanManifestMetadata> {
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
