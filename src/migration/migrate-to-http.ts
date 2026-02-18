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
/* eslint-disable no-console */

import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { 
    createSqliteProvider, 
    generatePlanUuid, 
    formatPlanFilename,
    type PlanMetadata as FormatPlanMetadata,
    type PlanStep as FormatPlanStep 
} from '@kjerneverk/riotplan-format';
import { loadPlan } from '../plan/loader.js';
import type { Plan } from '../types.js';

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
 * Infer file type from filename
 */
function inferFileType(filename: string): 'idea' | 'shaping' | 'summary' | 'execution_plan' | 'status' | 'provenance' | 'lifecycle' | 'evidence' | 'feedback' | 'prompt' | 'reflection' | 'other' {
    const lower = filename.toLowerCase();
    if (lower === 'idea.md') return 'idea';
    if (lower === 'shaping.md') return 'shaping';
    if (lower === 'summary.md') return 'summary';
    if (lower === 'execution_plan.md') return 'execution_plan';
    if (lower === 'status.md') return 'status';
    if (lower === 'provenance.md') return 'provenance';
    if (lower === 'lifecycle.md') return 'lifecycle';
    if (lower.includes('evidence')) return 'evidence';
    if (lower.includes('feedback')) return 'feedback';
    if (lower.includes('prompt')) return 'prompt';
    if (lower.includes('reflection')) return 'reflection';
    return 'other';
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

    // Map plan status to lifecycle stage
    const mapStatusToStage = (status: string): 'idea' | 'shaping' | 'built' | 'executing' | 'completed' | 'cancelled' => {
        if (status === 'completed') return 'completed';
        if (status === 'in_progress') return 'executing';
        if (status === 'pending') return 'built';
        return 'idea';
    };

    // Map riotplan metadata to riotplan-format metadata
    const formatMetadata: FormatPlanMetadata = {
        id: plan.metadata.code,
        uuid,
        name: plan.metadata.name,
        description: projectSlug 
            ? `[${projectSlug}] ${plan.metadata.description || ''}` 
            : plan.metadata.description,
        createdAt: plan.metadata.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stage: mapStatusToStage(plan.state.status),
        schemaVersion: 1,
    };

    // Initialize with metadata
    await provider.initialize(formatMetadata);

    // Migrate steps
    if (plan.steps && plan.steps.length > 0) {
        for (const step of plan.steps) {
            // Map TaskStatus to StepStatus (riotplan-format doesn't have 'failed')
            const mapStepStatus = (status: string): 'pending' | 'in_progress' | 'completed' | 'skipped' => {
                if (status === 'completed') return 'completed';
                if (status === 'in_progress') return 'in_progress';
                if (status === 'skipped') return 'skipped';
                if (status === 'failed') return 'skipped'; // Map failed to skipped
                return 'pending';
            };

            // Read step content from file
            const stepContent = (plan.files as unknown as Record<string, string>)[step.filename] || '';

            // Map riotplan step to riotplan-format step
            const formatStep: FormatPlanStep = {
                number: step.number,
                code: step.code || `step-${step.number}`,
                title: step.title,
                description: step.description,
                status: mapStepStatus(step.status),
                startedAt: step.startedAt?.toISOString(),
                completedAt: step.completedAt?.toISOString(),
                content: stepContent,
            };
            await provider.addStep(formatStep);
        }
    }

    // Migrate files
    if (plan.files) {
        const fileEntries = Object.entries(plan.files);
        for (const [filename, content] of fileEntries) {
            if (content) {
                await provider.saveFile({
                    type: inferFileType(filename),
                    filename,
                    content,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
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
