/**
 * Migration Validator
 * 
 * Validates that migration preserved all data correctly.
 */

import type { StorageProvider } from '../storage/provider.js';
import type { ValidationResult, ValidationError } from './types.js';

/**
 * Validates migration fidelity between source and target
 */
export class MigrationValidator {
    /**
     * Validate that target contains all data from source
     */
    async validate(
        source: StorageProvider,
        target: StorageProvider
    ): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: string[] = [];
        const stats = {
            stepsCompared: 0,
            filesCompared: 0,
            timelineEventsCompared: 0,
            evidenceCompared: 0,
            feedbackCompared: 0,
        };

        // Validate metadata
        await this.validateMetadata(source, target, errors);

        // Validate steps
        const stepsResult = await this.validateSteps(source, target, errors);
        stats.stepsCompared = stepsResult;

        // Validate files
        const filesResult = await this.validateFiles(source, target, errors);
        stats.filesCompared = filesResult;

        // Validate timeline events
        const timelineResult = await this.validateTimeline(source, target, errors, warnings);
        stats.timelineEventsCompared = timelineResult;

        // Validate evidence
        const evidenceResult = await this.validateEvidence(source, target, errors);
        stats.evidenceCompared = evidenceResult;

        // Validate feedback
        const feedbackResult = await this.validateFeedback(source, target, errors);
        stats.feedbackCompared = feedbackResult;

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            stats,
        };
    }

    private async validateMetadata(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[]
    ): Promise<void> {
        const sourceResult = await source.getMetadata();
        const targetResult = await target.getMetadata();

        if (!sourceResult.success || !sourceResult.data) {
            errors.push({
                type: 'metadata_difference',
                path: 'metadata',
                expected: 'valid metadata',
                actual: 'failed to read source metadata',
                message: 'Could not read source metadata',
            });
            return;
        }

        if (!targetResult.success || !targetResult.data) {
            errors.push({
                type: 'metadata_difference',
                path: 'metadata',
                expected: 'valid metadata',
                actual: 'failed to read target metadata',
                message: 'Could not read target metadata',
            });
            return;
        }

        const sourceData = sourceResult.data;
        const targetData = targetResult.data;

        if (sourceData.id !== targetData.id) {
            errors.push({
                type: 'metadata_difference',
                path: 'metadata.id',
                expected: sourceData.id,
                actual: targetData.id,
                message: `Plan ID mismatch: expected "${sourceData.id}", got "${targetData.id}"`,
            });
        }

        if (sourceData.name !== targetData.name) {
            errors.push({
                type: 'metadata_difference',
                path: 'metadata.name',
                expected: sourceData.name,
                actual: targetData.name,
                message: `Plan name mismatch: expected "${sourceData.name}", got "${targetData.name}"`,
            });
        }

        if (sourceData.stage !== targetData.stage) {
            errors.push({
                type: 'metadata_difference',
                path: 'metadata.stage',
                expected: sourceData.stage,
                actual: targetData.stage,
                message: `Plan stage mismatch: expected "${sourceData.stage}", got "${targetData.stage}"`,
            });
        }
    }

    private async validateSteps(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[]
    ): Promise<number> {
        const sourceResult = await source.getSteps();
        const targetResult = await target.getSteps();

        if (!sourceResult.success || !sourceResult.data) {
            return 0;
        }

        const sourceSteps = sourceResult.data;
        const targetSteps = targetResult.data || [];

        for (const sourceStep of sourceSteps) {
            const targetStep = targetSteps.find(s => s.number === sourceStep.number);

            if (!targetStep) {
                errors.push({
                    type: 'missing_step',
                    path: `steps[${sourceStep.number}]`,
                    expected: sourceStep,
                    actual: null,
                    message: `Step ${sourceStep.number} is missing in target`,
                });
                continue;
            }

            if (sourceStep.title !== targetStep.title) {
                errors.push({
                    type: 'content_mismatch',
                    path: `steps[${sourceStep.number}].title`,
                    expected: sourceStep.title,
                    actual: targetStep.title,
                    message: `Step ${sourceStep.number} title mismatch`,
                });
            }

            if (sourceStep.status !== targetStep.status) {
                errors.push({
                    type: 'content_mismatch',
                    path: `steps[${sourceStep.number}].status`,
                    expected: sourceStep.status,
                    actual: targetStep.status,
                    message: `Step ${sourceStep.number} status mismatch`,
                });
            }

            // Compare content (normalize whitespace for comparison)
            const sourceContent = sourceStep.content.trim();
            const targetContent = targetStep.content.trim();
            if (sourceContent !== targetContent) {
                errors.push({
                    type: 'content_mismatch',
                    path: `steps[${sourceStep.number}].content`,
                    expected: `${sourceContent.length} chars`,
                    actual: `${targetContent.length} chars`,
                    message: `Step ${sourceStep.number} content mismatch`,
                });
            }
        }

        // Check for extra steps in target
        for (const targetStep of targetSteps) {
            const sourceStep = sourceSteps.find(s => s.number === targetStep.number);
            if (!sourceStep) {
                errors.push({
                    type: 'content_mismatch',
                    path: `steps[${targetStep.number}]`,
                    expected: null,
                    actual: targetStep,
                    message: `Unexpected step ${targetStep.number} in target`,
                });
            }
        }

        return sourceSteps.length;
    }

    private async validateFiles(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[]
    ): Promise<number> {
        const sourceResult = await source.getFiles();
        const targetResult = await target.getFiles();

        if (!sourceResult.success || !sourceResult.data) {
            return 0;
        }

        const sourceFiles = sourceResult.data;
        const targetFiles = targetResult.data || [];

        for (const sourceFile of sourceFiles) {
            const targetFile = targetFiles.find(
                f => f.type === sourceFile.type && f.filename === sourceFile.filename
            );

            if (!targetFile) {
                errors.push({
                    type: 'missing_file',
                    path: `files[${sourceFile.type}/${sourceFile.filename}]`,
                    expected: sourceFile,
                    actual: null,
                    message: `File ${sourceFile.filename} (${sourceFile.type}) is missing in target`,
                });
                continue;
            }

            // Compare content
            const sourceContent = sourceFile.content.trim();
            const targetContent = targetFile.content.trim();
            if (sourceContent !== targetContent) {
                errors.push({
                    type: 'content_mismatch',
                    path: `files[${sourceFile.type}/${sourceFile.filename}].content`,
                    expected: `${sourceContent.length} chars`,
                    actual: `${targetContent.length} chars`,
                    message: `File ${sourceFile.filename} content mismatch`,
                });
            }
        }

        return sourceFiles.length;
    }

    private async validateTimeline(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[],
        warnings: string[]
    ): Promise<number> {
        const sourceResult = await source.getTimelineEvents();
        const targetResult = await target.getTimelineEvents();

        if (!sourceResult.success || !sourceResult.data) {
            return 0;
        }

        const sourceEvents = sourceResult.data;
        const targetEvents = targetResult.data || [];

        // Timeline events may have different IDs after migration, so compare by type and timestamp
        for (const sourceEvent of sourceEvents) {
            const targetEvent = targetEvents.find(
                e => e.type === sourceEvent.type && e.timestamp === sourceEvent.timestamp
            );

            if (!targetEvent) {
                // Timeline events might be regenerated, so this is a warning not an error
                warnings.push(
                    `Timeline event ${sourceEvent.type} at ${sourceEvent.timestamp} not found in target`
                );
            }
        }

        return sourceEvents.length;
    }

    private async validateEvidence(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[]
    ): Promise<number> {
        const sourceResult = await source.getEvidence();
        const targetResult = await target.getEvidence();

        if (!sourceResult.success || !sourceResult.data) {
            return 0;
        }

        const sourceEvidence = sourceResult.data;
        const targetEvidence = targetResult.data || [];

        for (const sourceItem of sourceEvidence) {
            const targetItem = targetEvidence.find(e => e.description === sourceItem.description);

            if (!targetItem) {
                errors.push({
                    type: 'missing_file',
                    path: `evidence[${sourceItem.id}]`,
                    expected: sourceItem,
                    actual: null,
                    message: `Evidence "${sourceItem.description}" is missing in target`,
                });
            }
        }

        return sourceEvidence.length;
    }

    private async validateFeedback(
        source: StorageProvider,
        target: StorageProvider,
        errors: ValidationError[]
    ): Promise<number> {
        const sourceResult = await source.getFeedback();
        const targetResult = await target.getFeedback();

        if (!sourceResult.success || !sourceResult.data) {
            return 0;
        }

        const sourceFeedback = sourceResult.data;
        const targetFeedback = targetResult.data || [];

        for (const sourceItem of sourceFeedback) {
            const targetItem = targetFeedback.find(f => f.content === sourceItem.content);

            if (!targetItem) {
                errors.push({
                    type: 'missing_file',
                    path: `feedback[${sourceItem.id}]`,
                    expected: sourceItem,
                    actual: null,
                    message: `Feedback "${sourceItem.title || sourceItem.id}" is missing in target`,
                });
            }
        }

        return sourceFeedback.length;
    }
}

/**
 * Create a migration validator
 */
export function createValidator(): MigrationValidator {
    return new MigrationValidator();
}
