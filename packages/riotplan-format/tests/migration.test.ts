/**
 * Tests for migration utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SqliteStorageProvider } from '../src/storage/sqlite-provider.js';
import { PlanMigrator, createMigrator, generateTargetPath, inferTargetFormat } from '../src/migration/migrator.js';
import { MigrationValidator, createValidator } from '../src/migration/validator.js';
import type { PlanMetadata, PlanStep, PlanFile, TimelineEvent, EvidenceRecord, FeedbackRecord } from '../src/types.js';

describe('Migration utilities', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `riotplan-migration-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('generateTargetPath', () => {
        it('should generate .plan path for sqlite target', () => {
            expect(generateTargetPath('/path/to/my-plan', 'directory', 'sqlite')).toBe('/path/to/my-plan.plan');
        });

        it('should remove trailing slash before adding extension', () => {
            expect(generateTargetPath('/path/to/my-plan/', 'directory', 'sqlite')).toBe('/path/to/my-plan.plan');
        });

        it('should generate _migrated path for directory target', () => {
            expect(generateTargetPath('/path/to/my-plan.plan', 'sqlite', 'directory')).toBe('/path/to/my-plan_migrated');
        });
    });

    describe('inferTargetFormat', () => {
        it('should return directory for sqlite source', () => {
            expect(inferTargetFormat('sqlite')).toBe('directory');
        });

        it('should return sqlite for directory source', () => {
            expect(inferTargetFormat('directory')).toBe('sqlite');
        });
    });

    describe('MigrationValidator', () => {
        let validator: MigrationValidator;

        beforeEach(() => {
            validator = createValidator();
        });

        it('should validate identical providers', async () => {
            // Create two identical SQLite databases
            const path1 = join(testDir, 'plan1.plan');
            const path2 = join(testDir, 'plan2.plan');

            const provider1 = new SqliteStorageProvider(path1);
            const provider2 = new SqliteStorageProvider(path2);

            const metadata: PlanMetadata = {
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            };

            await provider1.initialize(metadata);
            await provider2.initialize(metadata);

            // Add same step to both
            const step: PlanStep = {
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'pending',
                content: '# Step 1\n\nContent here.',
            };

            await provider1.addStep(step);
            await provider2.addStep(step);

            const result = await validator.validate(provider1, provider2);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.stats.stepsCompared).toBe(1);

            await provider1.close();
            await provider2.close();
        });

        it('should detect missing steps', async () => {
            const path1 = join(testDir, 'plan1.plan');
            const path2 = join(testDir, 'plan2.plan');

            const provider1 = new SqliteStorageProvider(path1);
            const provider2 = new SqliteStorageProvider(path2);

            const metadata: PlanMetadata = {
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            };

            await provider1.initialize(metadata);
            await provider2.initialize(metadata);

            // Add step only to source
            await provider1.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'pending',
                content: '# Step 1',
            });

            const result = await validator.validate(provider1, provider2);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].type).toBe('missing_step');

            await provider1.close();
            await provider2.close();
        });

        it('should detect metadata differences', async () => {
            const path1 = join(testDir, 'plan1.plan');
            const path2 = join(testDir, 'plan2.plan');

            const provider1 = new SqliteStorageProvider(path1);
            const provider2 = new SqliteStorageProvider(path2);

            await provider1.initialize({
                id: 'plan-1',
                name: 'Plan One',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            await provider2.initialize({
                id: 'plan-2', // Different ID
                name: 'Plan Two', // Different name
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const result = await validator.validate(provider1, provider2);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'metadata_difference')).toBe(true);

            await provider1.close();
            await provider2.close();
        });
    });

    describe('PlanMigrator', () => {
        let migrator: PlanMigrator;

        beforeEach(() => {
            migrator = createMigrator();
        });

        it('should migrate between SQLite providers', async () => {
            const sourcePath = join(testDir, 'source.plan');
            const targetPath = join(testDir, 'target.plan');

            const sourceProvider = new SqliteStorageProvider(sourcePath);
            const targetProvider = new SqliteStorageProvider(targetPath);

            // Initialize source with data
            await sourceProvider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                description: 'A test plan',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            await sourceProvider.addStep({
                number: 1,
                code: 'step-1',
                title: 'First Step',
                status: 'completed',
                content: '# First Step\n\nThis is the content.',
            });

            await sourceProvider.addStep({
                number: 2,
                code: 'step-2',
                title: 'Second Step',
                status: 'in_progress',
                content: '# Second Step\n\nMore content.',
            });

            await sourceProvider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea\n\nThe original idea.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await sourceProvider.addTimelineEvent({
                id: 'event-1',
                timestamp: new Date().toISOString(),
                type: 'plan_created',
                data: { code: 'test-plan' },
            });

            await sourceProvider.addEvidence({
                id: 'evidence-1',
                description: 'Research findings',
                source: 'web search',
                createdAt: new Date().toISOString(),
            });

            await sourceProvider.addFeedback({
                id: 'feedback-1',
                title: 'Review notes',
                content: 'Looks good!',
                createdAt: new Date().toISOString(),
            });

            // Migrate
            const result = await migrator.migrate(
                sourcePath,
                targetPath,
                sourceProvider,
                targetProvider,
                { keepSource: true, validate: true }
            );

            expect(result.success).toBe(true);
            expect(result.stats.stepsConverted).toBe(2);
            expect(result.stats.filesConverted).toBe(1);
            expect(result.stats.timelineEventsConverted).toBe(1);
            expect(result.stats.evidenceConverted).toBe(1);
            expect(result.stats.feedbackConverted).toBe(1);

            // Verify target has the data
            const targetSteps = await targetProvider.getSteps();
            expect(targetSteps.data).toHaveLength(2);

            const targetFiles = await targetProvider.getFiles();
            expect(targetFiles.data).toHaveLength(1);

            await sourceProvider.close();
            await targetProvider.close();
        });

        it('should fail if target exists without force option', async () => {
            const sourcePath = join(testDir, 'source.plan');
            const targetPath = join(testDir, 'target.plan');

            const sourceProvider = new SqliteStorageProvider(sourcePath);
            const targetProvider = new SqliteStorageProvider(targetPath);

            // Initialize both
            await sourceProvider.initialize({
                id: 'source',
                name: 'Source',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            await targetProvider.initialize({
                id: 'target',
                name: 'Target',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            // Try to migrate without force
            const result = await migrator.migrate(
                sourcePath,
                targetPath,
                sourceProvider,
                targetProvider,
                { force: false }
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');

            await sourceProvider.close();
            await targetProvider.close();
        });

        it('should report progress during migration', async () => {
            const sourcePath = join(testDir, 'source.plan');
            const targetPath = join(testDir, 'target.plan');

            const sourceProvider = new SqliteStorageProvider(sourcePath);
            const targetProvider = new SqliteStorageProvider(targetPath);

            await sourceProvider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const progressUpdates: string[] = [];

            await migrator.migrate(
                sourcePath,
                targetPath,
                sourceProvider,
                targetProvider,
                {
                    keepSource: true,
                    onProgress: (progress) => {
                        progressUpdates.push(progress.phase);
                    },
                }
            );

            expect(progressUpdates).toContain('reading');
            expect(progressUpdates).toContain('writing');
            expect(progressUpdates).toContain('converting');

            await sourceProvider.close();
            await targetProvider.close();
        });
    });
});
