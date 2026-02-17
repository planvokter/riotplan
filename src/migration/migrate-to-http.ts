/**
 * Migration utility for converting directory-based plans to UUID-based .plan files
 *
 * Usage:
 *   import { migrateToHttpFormat } from './migration/migrate-to-http';
 *   await migrateToHttpFormat({
 *     sourceDir: '/path/to/plans',
 *     targetDir: '/path/to/unified/plans',
 *     dryRun: false
 *   });
 */

import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createSqliteProvider, generatePlanUuid, formatPlanFilename } from '@kjerneverk/riotplan-format';
import { loadPlan } from '../plan/loader.js';

export interface MigrationOptions {
    /** Source directory containing directory-based plans */
    sourceDir: string;
    /** Target directory for .plan files */
    targetDir: string;
    /** Dry run mode - don't actually create files */
    dryRun?: boolean;
    /** Project slug to add to metadata (e.g., 'kjerneverk', 'redaksjon') */
    projectSlug?: string;
}

export interface MigrationResult {
    success: boolean;
    migratedCount: number;
    skippedCount: number;
    errors: Array<{ plan: string; error: string }>;
}

/**
 * Find all plan directories in a source directory
 */
function findPlanDirectories(sourceDir: string): string[] {
    const planDirs: string[] = [];

    function scanDirectory(dir: string): void {
        try {
            const entries = readdirSync(dir);

            // Check if this directory is a plan
            const hasStatusMd = entries.includes('STATUS.md');
            const hasSummaryMd = entries.includes('SUMMARY.md');
            const hasIdeaMd = entries.includes('IDEA.md');
            const hasPlanDir = entries.includes('plan');

            if (hasStatusMd || hasSummaryMd || hasIdeaMd || hasPlanDir) {
                planDirs.push(dir);
                return; // Don't scan subdirectories of a plan
            }

            // Recursively scan subdirectories
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                try {
                    const stat = statSync(fullPath);
                    if (stat.isDirectory() && !entry.startsWith('.')) {
                        scanDirectory(fullPath);
                    }
                } catch {
                    // Skip entries we can't stat
                }
            }
        } catch {
            // Skip directories we can't read
        }
    }

    scanDirectory(sourceDir);
    return planDirs;
}

/**
 * Determine category from source path
 */
function getCategoryFromPath(planPath: string): 'active' | 'done' | 'hold' {
    if (planPath.includes('/done/')) {
        return 'done';
    }
    if (planPath.includes('/hold/')) {
        return 'hold';
    }
    return 'active';
}

/**
 * Migrate a single plan
 */
async function migratePlan(
    sourcePath: string,
    targetDir: string,
    projectSlug?: string,
    dryRun?: boolean
): Promise<void> {
    // Load the plan from directory format
    const plan = await loadPlan(sourcePath);

    // Generate UUID
    const uuid = generatePlanUuid();

    // Create filename
    const slug = plan.metadata.code || basename(sourcePath);
    const filename = formatPlanFilename(uuid, slug);

    // Determine category and create subdirectory if needed
    const category = getCategoryFromPath(sourcePath);
    const categoryDir = category === 'active' ? targetDir : join(targetDir, category);

    if (!dryRun) {
        mkdirSync(categoryDir, { recursive: true });
    }

    const targetPath = join(categoryDir, filename);

    console.log(`  ${sourcePath} -> ${targetPath}`);
    console.log(`    UUID: ${uuid}`);
    console.log(`    Category: ${category}`);

    if (dryRun) {
        return;
    }

    // Create SQLite provider for target
    const provider = createSqliteProvider(targetPath);

    // Initialize with metadata
    await provider.initialize({
        ...plan.metadata,
        uuid,
        // Add project slug if provided
        ...(projectSlug ? { description: `[${projectSlug}] ${plan.metadata.description || ''}` } : {}),
    });

    // Migrate steps
    if (plan.steps) {
        for (const step of plan.steps) {
            await provider.addStep(step);
        }
    }

    // Migrate files
    if (plan.files) {
        for (const file of plan.files) {
            await provider.saveFile(file);
        }
    }

    // Migrate timeline events
    if (plan.timeline) {
        for (const event of plan.timeline) {
            await provider.addTimelineEvent(event);
        }
    }

    // Close provider
    await provider.close();
}

/**
 * Migrate all plans from source directory to target directory
 */
export async function migrateToHttpFormat(options: MigrationOptions): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        migratedCount: 0,
        skippedCount: 0,
        errors: [],
    };

    console.log(`Migrating plans from ${options.sourceDir} to ${options.targetDir}`);
    if (options.dryRun) {
        console.log('DRY RUN MODE - no files will be created');
    }

    // Find all plan directories
    const planDirs = findPlanDirectories(options.sourceDir);
    console.log(`Found ${planDirs.length} plans to migrate`);

    // Migrate each plan
    for (const planDir of planDirs) {
        try {
            await migratePlan(planDir, options.targetDir, options.projectSlug, options.dryRun);
            result.migratedCount++;
        } catch (error) {
            result.errors.push({
                plan: planDir,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            console.error(`  ERROR: ${error}`);
        }
    }

    console.log(`\nMigration complete:`);
    console.log(`  Migrated: ${result.migratedCount}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
        result.success = false;
        console.log(`\nErrors:`);
        for (const error of result.errors) {
            console.log(`  ${error.plan}: ${error.error}`);
        }
    }

    return result;
}
