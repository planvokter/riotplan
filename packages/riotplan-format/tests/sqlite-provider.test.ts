/**
 * Tests for SQLite Storage Provider
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SqliteStorageProvider, createSqliteProvider } from '../src/storage/sqlite-provider.js';
import type { PlanMetadata, PlanStep, PlanFile, TimelineEvent, EvidenceRecord, FeedbackRecord } from '../src/types.js';

describe('SqliteStorageProvider', () => {
    let testDir: string;
    let testDbPath: string;
    let provider: SqliteStorageProvider;

    beforeEach(() => {
        // Create a unique test directory
        testDir = join(tmpdir(), `riotplan-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
        testDbPath = join(testDir, 'test.plan');
    });

    afterEach(async () => {
        // Close provider if it exists
        if (provider) {
            await provider.close();
        }
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('initialization', () => {
        it('should create a new database file', async () => {
            provider = createSqliteProvider(testDbPath);
            
            const metadata: PlanMetadata = {
                id: 'test-plan',
                name: 'Test Plan',
                description: 'A test plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            };

            const result = await provider.initialize(metadata);
            
            expect(result.success).toBe(true);
            expect(existsSync(testDbPath)).toBe(true);
        });

        it('should report existence correctly', async () => {
            provider = createSqliteProvider(testDbPath);
            
            // Before initialization
            const existsBefore = await provider.exists();
            expect(existsBefore).toBe(false);

            // After initialization
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const existsAfter = await provider.exists();
            expect(existsAfter).toBe(true);
        });
    });

    describe('metadata operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                description: 'Initial description',
                stage: 'idea',
                createdAt: '2026-02-12T00:00:00.000Z',
                updatedAt: '2026-02-12T00:00:00.000Z',
                schemaVersion: 1,
            });
        });

        it('should get metadata', async () => {
            const result = await provider.getMetadata();
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe('test-plan');
            expect(result.data?.name).toBe('Test Plan');
            expect(result.data?.stage).toBe('idea');
        });

        it('should generate UUID if not provided', async () => {
            const result = await provider.getMetadata();
            
            expect(result.success).toBe(true);
            expect(result.data?.uuid).toBeDefined();
            expect(result.data?.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should use provided UUID', async () => {
            await provider.close();
            
            const customUuid = randomUUID();
            const newDbPath = join(testDir, 'test-with-uuid.plan');
            provider = createSqliteProvider(newDbPath);
            
            await provider.initialize({
                id: 'test-plan-2',
                uuid: customUuid,
                name: 'Test Plan 2',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            const result = await provider.getMetadata();
            expect(result.data?.uuid).toBe(customUuid);
        });

        it('should update metadata', async () => {
            await provider.updateMetadata({
                name: 'Updated Plan',
                stage: 'shaping',
            });

            const result = await provider.getMetadata();
            
            expect(result.data?.name).toBe('Updated Plan');
            expect(result.data?.stage).toBe('shaping');
        });
    });

    describe('step operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        it('should add and get steps', async () => {
            const step: PlanStep = {
                number: 1,
                code: 'first-step',
                title: 'First Step',
                description: 'The first step',
                status: 'pending',
                content: '# First Step\n\nContent here...',
            };

            await provider.addStep(step);
            
            const result = await provider.getStep(1);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.number).toBe(1);
            expect(result.data?.title).toBe('First Step');
            expect(result.data?.status).toBe('pending');
        });

        it('should get all steps', async () => {
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'completed',
                content: '# Step 1',
            });
            await provider.addStep({
                number: 2,
                code: 'step-2',
                title: 'Step 2',
                status: 'in_progress',
                content: '# Step 2',
            });
            await provider.addStep({
                number: 3,
                code: 'step-3',
                title: 'Step 3',
                status: 'pending',
                content: '# Step 3',
            });

            const result = await provider.getSteps();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data?.[0].number).toBe(1);
            expect(result.data?.[1].number).toBe(2);
            expect(result.data?.[2].number).toBe(3);
        });

        it('should update step status', async () => {
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'pending',
                content: '# Step 1',
            });

            await provider.updateStep(1, {
                status: 'in_progress',
                startedAt: new Date().toISOString(),
            });

            const result = await provider.getStep(1);
            
            expect(result.data?.status).toBe('in_progress');
            expect(result.data?.startedAt).toBeDefined();
        });

        it('should delete a step', async () => {
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'pending',
                content: '# Step 1',
            });

            await provider.deleteStep(1);

            const result = await provider.getStep(1);
            
            expect(result.data).toBeNull();
        });
    });

    describe('file operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        it('should save and get files', async () => {
            const file: PlanFile = {
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea\n\nThis is the idea content.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await provider.saveFile(file);
            
            const result = await provider.getFile('idea', 'IDEA.md');
            
            expect(result.success).toBe(true);
            expect(result.data?.content).toBe('# Idea\n\nThis is the idea content.');
        });

        it('should get all files', async () => {
            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            await provider.saveFile({
                type: 'status',
                filename: 'STATUS.md',
                content: '# Status',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            const result = await provider.getFiles();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
        });

        it('should update existing file', async () => {
            const now = new Date().toISOString();
            
            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: 'Original content',
                createdAt: now,
                updatedAt: now,
            });

            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: 'Updated content',
                createdAt: now,
                updatedAt: new Date().toISOString(),
            });

            const result = await provider.getFile('idea', 'IDEA.md');
            
            expect(result.data?.content).toBe('Updated content');
        });

        it('should delete a file', async () => {
            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await provider.deleteFile('idea', 'IDEA.md');

            const result = await provider.getFile('idea', 'IDEA.md');
            
            expect(result.data).toBeNull();
        });
    });

    describe('timeline operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        it('should add and get timeline events', async () => {
            const event: TimelineEvent = {
                id: 'event-1',
                timestamp: new Date().toISOString(),
                type: 'plan_created',
                data: { code: 'test-plan' },
            };

            await provider.addTimelineEvent(event);
            
            const result = await provider.getTimelineEvents();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].type).toBe('plan_created');
            expect(result.data?.[0].data).toEqual({ code: 'test-plan' });
        });

        it('should filter events by type', async () => {
            await provider.addTimelineEvent({
                id: 'event-1',
                timestamp: new Date().toISOString(),
                type: 'plan_created',
                data: {},
            });
            await provider.addTimelineEvent({
                id: 'event-2',
                timestamp: new Date().toISOString(),
                type: 'step_started',
                data: { step: 1 },
            });

            const result = await provider.getTimelineEvents({ type: 'step_started' });
            
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].type).toBe('step_started');
        });

        it('should limit events', async () => {
            for (let i = 0; i < 10; i++) {
                await provider.addTimelineEvent({
                    id: `event-${i}`,
                    timestamp: new Date(Date.now() + i * 1000).toISOString(),
                    type: 'note_added',
                    data: { index: i },
                });
            }

            const result = await provider.getTimelineEvents({ limit: 5 });
            
            expect(result.data).toHaveLength(5);
        });
    });

    describe('evidence operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'idea',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        it('should add and get evidence', async () => {
            const evidence: EvidenceRecord = {
                id: 'evidence-1',
                description: 'Research findings',
                source: 'web search',
                sourceUrl: 'https://example.com',
                gatheringMethod: 'model-assisted',
                content: 'The findings show...',
                createdAt: new Date().toISOString(),
            };

            await provider.addEvidence(evidence);
            
            const result = await provider.getEvidence();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].description).toBe('Research findings');
            expect(result.data?.[0].sourceUrl).toBe('https://example.com');
        });
    });

    describe('feedback operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'shaping',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });
        });

        it('should add and get feedback', async () => {
            const feedback: FeedbackRecord = {
                id: 'feedback-1',
                title: 'Review session',
                platform: 'Cursor',
                content: 'The approach looks good...',
                participants: ['user', 'assistant'],
                createdAt: new Date().toISOString(),
            };

            await provider.addFeedback(feedback);
            
            const result = await provider.getFeedback();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].title).toBe('Review session');
            expect(result.data?.[0].participants).toEqual(['user', 'assistant']);
        });
    });

    describe('checkpoint operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'executing',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            // Add some steps
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'Step 1',
                status: 'completed',
                content: '# Step 1',
            });
            await provider.addStep({
                number: 2,
                code: 'step-2',
                title: 'Step 2',
                status: 'in_progress',
                content: '# Step 2',
            });
        });

        it('should create and get checkpoints', async () => {
            const snapshot = await provider.createSnapshot();
            
            await provider.createCheckpoint({
                name: 'before-step-3',
                message: 'Checkpoint before starting step 3',
                createdAt: new Date().toISOString(),
                snapshot,
            });

            const result = await provider.getCheckpoint('before-step-3');
            
            expect(result.success).toBe(true);
            expect(result.data?.name).toBe('before-step-3');
            expect(result.data?.snapshot.metadata.id).toBe('test-plan');
        });

        it('should list all checkpoints', async () => {
            const snapshot = await provider.createSnapshot();
            
            await provider.createCheckpoint({
                name: 'checkpoint-1',
                message: 'First checkpoint',
                createdAt: new Date().toISOString(),
                snapshot,
            });
            await provider.createCheckpoint({
                name: 'checkpoint-2',
                message: 'Second checkpoint',
                createdAt: new Date().toISOString(),
                snapshot,
            });

            const result = await provider.getCheckpoints();
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
        });

        it('should restore from checkpoint', async () => {
            // Create initial state
            await provider.saveFile({
                type: 'status',
                filename: 'STATUS.md',
                content: '# Status: In Progress',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Create checkpoint
            const snapshot = await provider.createSnapshot();
            await provider.createCheckpoint({
                name: 'before-changes',
                message: 'Before making changes',
                createdAt: new Date().toISOString(),
                snapshot,
            });

            // Make changes
            await provider.updateStep(2, { status: 'completed' });
            await provider.updateMetadata({ stage: 'completed' });

            // Verify changes
            let stepResult = await provider.getStep(2);
            expect(stepResult.data?.status).toBe('completed');

            // Restore checkpoint
            await provider.restoreCheckpoint('before-changes');

            // Verify restoration
            stepResult = await provider.getStep(2);
            expect(stepResult.data?.status).toBe('in_progress');
            
            const metadataResult = await provider.getMetadata();
            expect(metadataResult.data?.stage).toBe('executing');
        });
    });

    describe('search operations', () => {
        beforeEach(async () => {
            provider = createSqliteProvider(testDbPath);
            await provider.initialize({
                id: 'test-plan',
                name: 'Test Plan',
                stage: 'built',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                schemaVersion: 1,
            });

            await provider.addStep({
                number: 1,
                code: 'authentication',
                title: 'Implement Authentication',
                status: 'pending',
                content: '# Authentication\n\nImplement JWT-based authentication with refresh tokens.',
            });
            await provider.addStep({
                number: 2,
                code: 'authorization',
                title: 'Implement Authorization',
                status: 'pending',
                content: '# Authorization\n\nImplement role-based access control.',
            });
            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea\n\nBuild a secure authentication system using JWT tokens.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        });

        it('should search across steps and files', async () => {
            const result = await provider.search('JWT');
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.length).toBeGreaterThan(0);
            
            // Should find matches in both step and file
            const types = result.data!.map(r => r.type);
            expect(types).toContain('step');
            expect(types).toContain('file');
        });

        it('should return snippets with context', async () => {
            const result = await provider.search('authentication');
            
            expect(result.success).toBe(true);
            expect(result.data?.[0].snippet).toBeDefined();
            expect(result.data?.[0].snippet.length).toBeGreaterThan(0);
        });

        it('should sort results by relevance', async () => {
            const result = await provider.search('authentication');
            
            expect(result.success).toBe(true);
            
            // Results should be sorted by score descending
            for (let i = 1; i < result.data!.length; i++) {
                expect(result.data![i - 1].score).toBeGreaterThanOrEqual(result.data![i].score);
            }
        });
    });
});
