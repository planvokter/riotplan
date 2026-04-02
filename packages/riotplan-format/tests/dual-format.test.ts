/**
 * Dual Format Feature Parity Tests
 * 
 * These tests ensure that both storage formats (SQLite and directory)
 * provide identical functionality and data preservation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SqliteStorageProvider } from '../src/storage/sqlite-provider.js';
import { PlanMigrator } from '../src/migration/migrator.js';
import { MigrationValidator } from '../src/migration/validator.js';
import type {
    PlanMetadata,
    PlanStep,
    PlanFile,
    TimelineEvent,
    EvidenceRecord,
    FeedbackRecord,
    Checkpoint,
} from '../src/types.js';

describe('Dual Format Feature Parity', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `riotplan-dual-format-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('SQLite Provider Full Feature Test', () => {
        let provider: SqliteStorageProvider;
        let planPath: string;

        beforeEach(async () => {
            planPath = join(testDir, 'test.plan');
            provider = new SqliteStorageProvider(planPath);
            
            await provider.initialize({
                id: 'feature-test',
                name: 'Feature Test Plan',
                description: 'Testing all features',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        afterEach(async () => {
            await provider.close();
        });

        it('should support all step operations', async () => {
            // Add steps
            const step1: PlanStep = {
                number: 1,
                code: 'step-1',
                title: 'First Step',
                status: 'pending',
                content: '# First Step\n\nContent here.',
            };
            const step2: PlanStep = {
                number: 2,
                code: 'step-2',
                title: 'Second Step',
                status: 'pending',
                content: '# Second Step\n\nMore content.',
            };

            await provider.addStep(step1);
            await provider.addStep(step2);

            // Get steps
            const stepsResult = await provider.getSteps();
            expect(stepsResult.success).toBe(true);
            expect(stepsResult.data).toHaveLength(2);

            // Get single step
            const singleResult = await provider.getStep(1);
            expect(singleResult.success).toBe(true);
            expect(singleResult.data?.title).toBe('First Step');

            // Update step
            await provider.updateStep(1, { status: 'in_progress', startedAt: new Date().toISOString() });
            const updatedResult = await provider.getStep(1);
            expect(updatedResult.data?.status).toBe('in_progress');

            // Delete step
            await provider.deleteStep(2);
            const afterDeleteResult = await provider.getSteps();
            expect(afterDeleteResult.data).toHaveLength(1);
        });

        it('should support all file operations', async () => {
            const file: PlanFile = {
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea\n\nThe original concept.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Save file
            await provider.saveFile(file);

            // Get files
            const filesResult = await provider.getFiles();
            expect(filesResult.success).toBe(true);
            expect(filesResult.data).toHaveLength(1);
            expect(filesResult.data?.[0].content).toBe(file.content);

            // Get single file
            const singleResult = await provider.getFile('idea', 'IDEA.md');
            expect(singleResult.success).toBe(true);
            expect(singleResult.data?.content).toBe(file.content);

            // Update file
            const updatedFile = { ...file, content: '# Updated Idea\n\nNew content.' };
            await provider.saveFile(updatedFile);
            const afterUpdateResult = await provider.getFile('idea', 'IDEA.md');
            expect(afterUpdateResult.data?.content).toBe(updatedFile.content);

            // Delete file
            await provider.deleteFile('idea', 'IDEA.md');
            const afterDeleteResult = await provider.getFiles();
            expect(afterDeleteResult.data).toHaveLength(0);
        });

        it('should support all timeline operations', async () => {
            const event: TimelineEvent = {
                id: 'event-1',
                timestamp: new Date().toISOString(),
                type: 'plan_created',
                data: { code: 'feature-test' },
            };

            // Add event
            await provider.addTimelineEvent(event);

            // Get events
            const eventsResult = await provider.getTimelineEvents();
            expect(eventsResult.success).toBe(true);
            expect(eventsResult.data).toHaveLength(1);
            expect(eventsResult.data?.[0].type).toBe('plan_created');

            // Add more events
            await provider.addTimelineEvent({
                id: 'event-2',
                timestamp: new Date().toISOString(),
                type: 'step_started',
                data: { step: 1 },
            });

            const allEventsResult = await provider.getTimelineEvents();
            expect(allEventsResult.data).toHaveLength(2);
        });

        it('should support all evidence operations', async () => {
            const evidence: EvidenceRecord = {
                id: 'evidence-1',
                description: 'Research findings from web search',
                source: 'web search',
                sourceUrl: 'https://example.com/article',
                content: 'The article discusses...',
                gatheringMethod: 'model-assisted',
                relevanceScore: 0.85,
                createdAt: new Date().toISOString(),
            };

            // Add evidence
            await provider.addEvidence(evidence);

            // Get evidence
            const evidenceResult = await provider.getEvidence();
            expect(evidenceResult.success).toBe(true);
            expect(evidenceResult.data).toHaveLength(1);
            expect(evidenceResult.data?.[0].description).toBe(evidence.description);
            expect(evidenceResult.data?.[0].relevanceScore).toBe(0.85);
        });

        it('should support all feedback operations', async () => {
            const feedback: FeedbackRecord = {
                id: 'feedback-1',
                title: 'Code Review Notes',
                content: 'The implementation looks good overall.',
                platform: 'github',
                participants: ['alice', 'bob'],
                createdAt: new Date().toISOString(),
            };

            // Add feedback
            await provider.addFeedback(feedback);

            // Get feedback
            const feedbackResult = await provider.getFeedback();
            expect(feedbackResult.success).toBe(true);
            expect(feedbackResult.data).toHaveLength(1);
            expect(feedbackResult.data?.[0].title).toBe(feedback.title);
            expect(feedbackResult.data?.[0].participants).toEqual(['alice', 'bob']);
        });

        it('should support checkpoint operations', async () => {
            // Add some data first
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'completed',
                content: '# Step 1',
            });

            // Create checkpoint
            const checkpoint: Checkpoint = {
                name: 'before-refactor',
                message: 'Saving state before major refactor',
                createdAt: new Date().toISOString(),
                snapshot: await provider.createSnapshot(),
            };

            await provider.createCheckpoint(checkpoint);

            // Get checkpoints
            const checkpointsResult = await provider.getCheckpoints();
            expect(checkpointsResult.success).toBe(true);
            expect(checkpointsResult.data).toHaveLength(1);
            expect(checkpointsResult.data?.[0].name).toBe('before-refactor');

            // Modify data
            await provider.updateStep(1, { status: 'in_progress' });

            // Restore checkpoint
            await provider.restoreCheckpoint('before-refactor');

            // Verify restoration
            const stepResult = await provider.getStep(1);
            expect(stepResult.data?.status).toBe('completed');
        });

        it('should support search operations', async () => {
            // Add searchable content
            await provider.addStep({
                number: 1,
                code: 'auth-step',
                title: 'Implement Authentication',
                status: 'pending',
                content: '# Authentication\n\nImplement JWT-based authentication.',
            });

            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Authentication Feature\n\nSecure user authentication using JWT tokens.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Search for content
            const searchResult = await provider.search('JWT');
            expect(searchResult.success).toBe(true);
            expect(searchResult.data?.length).toBeGreaterThan(0);

            // Search should find in both steps and files
            const types = searchResult.data?.map(r => r.type) || [];
            expect(types).toContain('step');
            expect(types).toContain('file');
        });
    });

    describe('Round-trip Migration', () => {
        it('should preserve all data through SQLite-to-SQLite migration', async () => {
            const sourcePath = join(testDir, 'source.plan');
            const targetPath = join(testDir, 'target.plan');

            const source = new SqliteStorageProvider(sourcePath);
            const target = new SqliteStorageProvider(targetPath);

            // Create comprehensive source data
            await source.initialize({
                id: 'roundtrip-test',
                name: 'Round Trip Test',
                description: 'Testing data preservation',
                stage: 'executing',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T12:00:00Z',
                schemaVersion: 1,
            });

            // Add steps
            await source.addStep({
                number: 1,
                code: 'step-1',
                title: 'First Step',
                status: 'completed',
                content: '# First Step\n\nDetailed content here.',
                startedAt: '2024-01-02T00:00:00Z',
                completedAt: '2024-01-03T00:00:00Z',
            });

            await source.addStep({
                number: 2,
                code: 'step-2',
                title: 'Second Step',
                status: 'in_progress',
                content: '# Second Step\n\nMore content.',
                startedAt: '2024-01-04T00:00:00Z',
            });

            // Add files
            await source.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Original Idea\n\nThe concept.',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });

            await source.saveFile({
                type: 'shaping',
                filename: 'SHAPING.md',
                content: '# Shaping Notes\n\nApproach analysis.',
                createdAt: '2024-01-05T00:00:00Z',
                updatedAt: '2024-01-05T00:00:00Z',
            });

            // Add timeline events
            await source.addTimelineEvent({
                id: 'event-1',
                timestamp: '2024-01-01T00:00:00Z',
                type: 'plan_created',
                data: { code: 'roundtrip-test' },
            });

            await source.addTimelineEvent({
                id: 'event-2',
                timestamp: '2024-01-02T00:00:00Z',
                type: 'step_started',
                data: { step: 1 },
            });

            // Add evidence
            await source.addEvidence({
                id: 'evidence-1',
                description: 'Research article',
                source: 'web',
                content: 'Article content...',
                createdAt: '2024-01-01T00:00:00Z',
            });

            // Add feedback
            await source.addFeedback({
                id: 'feedback-1',
                title: 'Review',
                content: 'Looks good!',
                createdAt: '2024-01-03T00:00:00Z',
            });

            // Migrate
            const migrator = new PlanMigrator();
            const result = await migrator.migrate(
                sourcePath,
                targetPath,
                source,
                target,
                { keepSource: true, validate: true }
            );

            expect(result.success).toBe(true);
            expect(result.stats.stepsConverted).toBe(2);
            expect(result.stats.filesConverted).toBe(2);
            expect(result.stats.timelineEventsConverted).toBe(2);
            expect(result.stats.evidenceConverted).toBe(1);
            expect(result.stats.feedbackConverted).toBe(1);

            // Validate with MigrationValidator
            const validator = new MigrationValidator();
            const validationResult = await validator.validate(source, target);

            expect(validationResult.valid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);

            await source.close();
            await target.close();
        });
    });

    describe('Data Integrity', () => {
        it('should preserve special characters in content', async () => {
            const planPath = join(testDir, 'special-chars.plan');
            const provider = new SqliteStorageProvider(planPath);

            await provider.initialize({
                id: 'special-chars',
                name: 'Special Characters Test',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const specialContent = `# Step with Special Characters

This content has:
- Unicode: 你好世界 🎉 ñ é ü
- Code blocks: \`const x = "hello"\`
- SQL-like: SELECT * FROM users WHERE name = 'O''Brien'
- Markdown: **bold** _italic_ ~~strikethrough~~
- HTML entities: &lt;div&gt; &amp; &quot;
- Newlines and tabs:
\tIndented with tab
    Indented with spaces
`;

            await provider.addStep({
                number: 1,
                code: 'special',
                title: 'Special Characters',
                status: 'pending',
                content: specialContent,
            });

            // Retrieve and verify
            const result = await provider.getStep(1);
            expect(result.data?.content).toBe(specialContent);

            await provider.close();
        });

        it('should handle large content', async () => {
            const planPath = join(testDir, 'large-content.plan');
            const provider = new SqliteStorageProvider(planPath);

            await provider.initialize({
                id: 'large-content',
                name: 'Large Content Test',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            // Create 1MB of content
            const largeContent = '# Large Content\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(50000);

            await provider.addStep({
                number: 1,
                code: 'large',
                title: 'Large Step',
                status: 'pending',
                content: largeContent,
            });

            const result = await provider.getStep(1);
            expect(result.data?.content.length).toBe(largeContent.length);

            await provider.close();
        });

        it('should preserve JSON data in timeline events', async () => {
            const planPath = join(testDir, 'json-data.plan');
            const provider = new SqliteStorageProvider(planPath);

            await provider.initialize({
                id: 'json-data',
                name: 'JSON Data Test',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const complexData = {
                nested: {
                    array: [1, 2, { key: 'value' }],
                    object: { a: 1, b: 'two' },
                },
                special: 'quotes "and" apostrophes\'s',
                unicode: '日本語',
            };

            await provider.addTimelineEvent({
                id: 'complex-event',
                timestamp: new Date().toISOString(),
                type: 'custom',
                data: complexData,
            });

            const result = await provider.getTimelineEvents();
            expect(result.data?.[0].data).toEqual(complexData);

            await provider.close();
        });
    });
});
