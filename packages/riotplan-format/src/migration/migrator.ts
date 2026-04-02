/**
 * Plan Migrator
 * 
 * Handles bidirectional conversion between directory and SQLite formats.
 */

import { existsSync, unlinkSync, rmSync } from 'node:fs';
import type { StorageProvider } from '../storage/provider.js';
import type { StorageFormat } from '../types.js';
import { ensureFormatExtension } from '../storage/utils.js';
import { MigrationValidator } from './validator.js';
import type {
    MigrationOptions,
    MigrationResult,
    MigrationStats,
    MigrationProgress,
} from './types.js';

/**
 * Migrates plans between directory and SQLite formats
 */
export class PlanMigrator {
    private validator: MigrationValidator;

    constructor() {
        this.validator = new MigrationValidator();
    }

    /**
     * Migrate a plan from source to target format
     * 
     * @param sourcePath - Path to source plan
     * @param targetPath - Path for target plan
     * @param sourceProvider - Provider for reading source
     * @param targetProvider - Provider for writing target
     * @param options - Migration options
     */
    async migrate(
        sourcePath: string,
        targetPath: string,
        sourceProvider: StorageProvider,
        targetProvider: StorageProvider,
        options: MigrationOptions = {}
    ): Promise<MigrationResult> {
        const startTime = Date.now();
        const warnings: string[] = [];
        const stats: MigrationStats = {
            stepsConverted: 0,
            filesConverted: 0,
            timelineEventsConverted: 0,
            evidenceConverted: 0,
            feedbackConverted: 0,
            checkpointsConverted: 0,
        };

        try {
            // Detect formats
            const sourceFormat = sourceProvider.format;
            const targetFormat = targetProvider.format;

            // Check if target exists
            const targetExists = await targetProvider.exists();
            if (targetExists && !options.force) {
                return {
                    success: false,
                    sourceFormat,
                    targetFormat,
                    sourcePath,
                    targetPath,
                    error: `Target already exists: ${targetPath}. Use force option to overwrite.`,
                    warnings,
                    stats,
                    duration: Date.now() - startTime,
                };
            }

            // Report progress: reading
            this.reportProgress(options.onProgress, {
                phase: 'reading',
                percentage: 0,
            });

            // Read metadata from source
            const metadataResult = await sourceProvider.getMetadata();
            if (!metadataResult.success || !metadataResult.data) {
                return {
                    success: false,
                    sourceFormat,
                    targetFormat,
                    sourcePath,
                    targetPath,
                    error: `Failed to read source metadata: ${metadataResult.error}`,
                    warnings,
                    stats,
                    duration: Date.now() - startTime,
                };
            }

            // Initialize target with metadata
            this.reportProgress(options.onProgress, {
                phase: 'writing',
                percentage: 10,
                currentItem: 'metadata',
            });

            const initResult = await targetProvider.initialize(metadataResult.data);
            if (!initResult.success) {
                return {
                    success: false,
                    sourceFormat,
                    targetFormat,
                    sourcePath,
                    targetPath,
                    error: `Failed to initialize target: ${initResult.error}`,
                    warnings,
                    stats,
                    duration: Date.now() - startTime,
                };
            }

            // Migrate steps
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 20,
                currentItem: 'steps',
            });
            stats.stepsConverted = await this.migrateSteps(sourceProvider, targetProvider);

            // Migrate files
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 40,
                currentItem: 'files',
            });
            stats.filesConverted = await this.migrateFiles(sourceProvider, targetProvider);

            // Migrate timeline events
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 60,
                currentItem: 'timeline',
            });
            stats.timelineEventsConverted = await this.migrateTimeline(sourceProvider, targetProvider);

            // Migrate evidence
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 70,
                currentItem: 'evidence',
            });
            stats.evidenceConverted = await this.migrateEvidence(sourceProvider, targetProvider);

            // Migrate feedback
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 80,
                currentItem: 'feedback',
            });
            stats.feedbackConverted = await this.migrateFeedback(sourceProvider, targetProvider);

            // Migrate checkpoints
            this.reportProgress(options.onProgress, {
                phase: 'converting',
                percentage: 90,
                currentItem: 'checkpoints',
            });
            stats.checkpointsConverted = await this.migrateCheckpoints(sourceProvider, targetProvider);

            // Validate if requested
            if (options.validate) {
                this.reportProgress(options.onProgress, {
                    phase: 'validating',
                    percentage: 95,
                });

                const validationResult = await this.validator.validate(sourceProvider, targetProvider);
                if (!validationResult.valid) {
                    const errorMessages = validationResult.errors.map(e => e.message).join('; ');
                    return {
                        success: false,
                        sourceFormat,
                        targetFormat,
                        sourcePath,
                        targetPath,
                        error: `Validation failed: ${errorMessages}`,
                        warnings: [...warnings, ...validationResult.warnings],
                        stats,
                        duration: Date.now() - startTime,
                    };
                }
                warnings.push(...validationResult.warnings);
            }

            // Delete source if not keeping
            if (!options.keepSource) {
                await this.deleteSource(sourcePath, sourceFormat);
            }

            this.reportProgress(options.onProgress, {
                phase: 'writing',
                percentage: 100,
            });

            return {
                success: true,
                sourceFormat,
                targetFormat,
                sourcePath,
                targetPath,
                warnings,
                stats,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                sourceFormat: sourceProvider.format,
                targetFormat: targetProvider.format,
                sourcePath,
                targetPath,
                error: error instanceof Error ? error.message : 'Unknown error during migration',
                warnings,
                stats,
                duration: Date.now() - startTime,
            };
        }
    }

    private async migrateSteps(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getSteps();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const step of result.data) {
            await target.addStep(step);
        }

        return result.data.length;
    }

    private async migrateFiles(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getFiles();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const file of result.data) {
            await target.saveFile(file);
        }

        return result.data.length;
    }

    private async migrateTimeline(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getTimelineEvents();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const event of result.data) {
            await target.addTimelineEvent(event);
        }

        return result.data.length;
    }

    private async migrateEvidence(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getEvidence();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const evidence of result.data) {
            await target.addEvidence(evidence);
        }

        return result.data.length;
    }

    private async migrateFeedback(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getFeedback();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const feedback of result.data) {
            await target.addFeedback(feedback);
        }

        return result.data.length;
    }

    private async migrateCheckpoints(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<number> {
        const result = await source.getCheckpoints();
        if (!result.success || !result.data) {
            return 0;
        }

        for (const checkpoint of result.data) {
            await target.createCheckpoint(checkpoint);
        }

        return result.data.length;
    }

    private async deleteSource(sourcePath: string, format: StorageFormat): Promise<void> {
        if (!existsSync(sourcePath)) {
            return;
        }

        if (format === 'sqlite') {
            // Delete SQLite file and any WAL/SHM files
            unlinkSync(sourcePath);
            const walPath = sourcePath + '-wal';
            const shmPath = sourcePath + '-shm';
            if (existsSync(walPath)) unlinkSync(walPath);
            if (existsSync(shmPath)) unlinkSync(shmPath);
        } else {
            // Delete directory recursively
            rmSync(sourcePath, { recursive: true, force: true });
        }
    }

    private reportProgress(
        callback: ((progress: MigrationProgress) => void) | undefined,
        progress: MigrationProgress
    ): void {
        if (callback) {
            callback(progress);
        }
    }
}

/**
 * Create a plan migrator
 */
export function createMigrator(): PlanMigrator {
    return new PlanMigrator();
}

/**
 * Generate a target path based on source path and target format
 */
export function generateTargetPath(
    sourcePath: string,
    sourceFormat: StorageFormat,
    targetFormat: StorageFormat
): string {
    if (targetFormat === 'sqlite') {
        // Remove trailing slash and add .plan extension
        const basePath = sourcePath.replace(/\/$/, '');
        return ensureFormatExtension(basePath, 'sqlite');
    } else {
        // Remove .plan extension and add _migrated suffix
        const basePath = sourcePath.replace(/\.plan$/, '');
        return basePath + '_migrated';
    }
}

/**
 * Infer target format from source format (opposite format)
 */
export function inferTargetFormat(sourceFormat: StorageFormat): StorageFormat {
    return sourceFormat === 'sqlite' ? 'directory' : 'sqlite';
}
