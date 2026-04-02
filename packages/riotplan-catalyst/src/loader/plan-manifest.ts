/**
 * Plan manifest read/write
 * @packageDocumentation
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { PlanManifestSchema, type PlanManifestOutput } from '@/schema/schemas.js';

/**
 * Plan manifest stored in plan.yaml
 * 
 * This is the metadata file for a plan that records:
 * - The plan's identity (ID and title)
 * - Which catalysts are associated with the plan
 * - When the plan was created
 * - Arbitrary metadata for extensibility
 */
export type PlanManifest = PlanManifestOutput;

const MANIFEST_FILENAME = 'plan.yaml';

/**
 * Read a plan manifest from plan.yaml
 * 
 * Returns null if the manifest file doesn't exist (graceful handling
 * for backward compatibility with plans created before catalyst support).
 * Throws if the file exists but contains invalid data.
 * 
 * @param planDirectory - Absolute path to plan directory
 * @returns Parsed and validated manifest, or null if not present
 * @throws Error if manifest exists but is invalid
 * 
 * @example
 * ```typescript
 * const manifest = await readPlanManifest('./my-plan');
 * if (manifest) {
 *   console.log(`Plan: ${manifest.title}`);
 *   console.log(`Uses catalysts: ${manifest.catalysts?.join(', ')}`);
 * }
 * ```
 */
export async function readPlanManifest(planDirectory: string): Promise<PlanManifest | null> {
    const manifestPath = join(planDirectory, MANIFEST_FILENAME);
  
    try {
        const content = await readFile(manifestPath, 'utf-8');
        const parsed = parseYaml(content);
    
        // Validate with Zod schema
        const result = PlanManifestSchema.safeParse(parsed);
    
        if (!result.success) {
            const errors = result.error.issues.map(issue => 
                `${issue.path.join('.')}: ${issue.message}`
            ).join('; ');
            throw new Error(`Invalid plan manifest: ${errors}`);
        }
    
        return result.data;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // File doesn't exist - return null for backward compatibility
            return null;
        }
        throw error;
    }
}

/**
 * Write a plan manifest to plan.yaml
 * 
 * Creates or overwrites the plan.yaml file with the provided manifest.
 * Automatically timestamps the manifest if `created` is not provided.
 * 
 * @param planDirectory - Absolute path to plan directory
 * @param manifest - Manifest to write
 * @throws Error if manifest is invalid or write fails
 * 
 * @example
 * ```typescript
 * const manifest: PlanManifest = {
 *   id: 'add-user-auth',
 *   title: 'Add User Authentication',
 *   catalysts: ['@kjerneverk/catalyst-nodejs'],
 *   created: new Date().toISOString(),
 * };
 * await writePlanManifest('./my-plan', manifest);
 * ```
 */
export async function writePlanManifest(
    planDirectory: string,
    manifest: PlanManifest
): Promise<void> {
    // Validate manifest
    const result = PlanManifestSchema.safeParse(manifest);
  
    if (!result.success) {
        const errors = result.error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
        ).join('; ');
        throw new Error(`Invalid plan manifest: ${errors}`);
    }
  
    // Ensure created timestamp exists
    const manifestToWrite: PlanManifest = {
        ...result.data,
        created: result.data.created || new Date().toISOString(),
    };
  
    // Serialize to YAML
    const yaml = stringifyYaml(manifestToWrite, {
        indent: 2,
        lineWidth: 120,
    });
  
    // Write to file
    const manifestPath = join(planDirectory, MANIFEST_FILENAME);
    await writeFile(manifestPath, yaml, 'utf-8');
}

/**
 * Update specific fields in a plan manifest
 * 
 * Reads the existing manifest (or creates a new one if it doesn't exist),
 * merges the provided updates, and writes it back.
 * 
 * @param planDirectory - Absolute path to plan directory
 * @param updates - Partial manifest to merge (only specified fields are changed)
 * @throws Error if updates are invalid or operation fails
 * 
 * @example
 * ```typescript
 * // Add a catalyst to an existing plan
 * await updatePlanManifest('./my-plan', {
 *   catalysts: ['@kjerneverk/catalyst-nodejs', '@kjerneverk/catalyst-react'],
 * });
 * ```
 */
export async function updatePlanManifest(
    planDirectory: string,
    updates: Partial<PlanManifest>
): Promise<void> {
    // Read existing manifest
    let existing = await readPlanManifest(planDirectory);
  
    // If no existing manifest, start with a minimal one
    if (!existing) {
    // Updates must contain at least id and title
        if (!updates.id || !updates.title) {
            throw new Error('Cannot create manifest without id and title');
        }
        existing = {
            id: '',
            title: '',
        };
    }
  
    // Merge updates
    const merged: PlanManifest = {
        ...existing,
        ...updates,
    };
  
    // Write back
    await writePlanManifest(planDirectory, merged);
}

/**
 * Add a catalyst to a plan's manifest
 * 
 * Convenience function that adds a catalyst ID to the catalysts array
 * without affecting other fields.
 * 
 * @param planDirectory - Absolute path to plan directory
 * @param catalystId - Catalyst ID to add
 * 
 * @example
 * ```typescript
 * await addCatalystToManifest('./my-plan', '@kjerneverk/catalyst-nodejs');
 * ```
 */
export async function addCatalystToManifest(
    planDirectory: string,
    catalystId: string
): Promise<void> {
    const manifest = await readPlanManifest(planDirectory);
    const currentCatalysts = manifest?.catalysts ?? [];
  
    // Only add if not already present
    if (!currentCatalysts.includes(catalystId)) {
        currentCatalysts.push(catalystId);
    }
  
    await updatePlanManifest(planDirectory, {
        catalysts: currentCatalysts,
    });
}

/**
 * Remove a catalyst from a plan's manifest
 * 
 * Convenience function that removes a catalyst ID from the catalysts array.
 * 
 * @param planDirectory - Absolute path to plan directory
 * @param catalystId - Catalyst ID to remove
 * 
 * @example
 * ```typescript
 * await removeCatalystFromManifest('./my-plan', '@kjerneverk/catalyst-old');
 * ```
 */
export async function removeCatalystFromManifest(
    planDirectory: string,
    catalystId: string
): Promise<void> {
    const manifest = await readPlanManifest(planDirectory);
    const currentCatalysts = manifest?.catalysts ?? [];
  
    const filtered = currentCatalysts.filter(id => id !== catalystId);
  
    if (filtered.length !== currentCatalysts.length) {
        await updatePlanManifest(planDirectory, {
            catalysts: filtered.length > 0 ? filtered : undefined,
        });
    }
}
