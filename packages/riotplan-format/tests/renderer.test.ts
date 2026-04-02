/**
 * Tests for markdown renderer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SqliteStorageProvider } from '../src/storage/sqlite-provider.js';
import { renderPlanToMarkdown } from '../src/renderer/markdown.js';

describe('Markdown Renderer', () => {
    let testDir: string;
    let provider: SqliteStorageProvider;
    let planPath: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-renderer-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
        
        planPath = join(testDir, 'test.plan');
        provider = new SqliteStorageProvider(planPath);

        await provider.initialize({
            id: 'render-test',
            name: 'Render Test Plan',
            description: 'A plan for testing rendering',
            stage: 'executing',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            schemaVersion: 1,
        });
    });

    afterEach(async () => {
        await provider.close();
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('renderPlanToMarkdown', () => {
        it('should render basic plan structure', async () => {
            const result = await renderPlanToMarkdown(provider);

            expect(result.files.has('SUMMARY.md')).toBe(true);
            expect(result.files.has('STATUS.md')).toBe(true);

            const summary = result.files.get('SUMMARY.md')!;
            expect(summary).toContain('# Render Test Plan');
            expect(summary).toContain('A plan for testing rendering');
            expect(summary).toContain('**Stage**: executing');
        });

        it('should render steps', async () => {
            await provider.addStep({
                number: 1,
                code: 'step-1',
                title: 'First Step',
                status: 'completed',
                content: '# First Step\n\nStep content here.',
                startedAt: '2024-01-02T00:00:00Z',
                completedAt: '2024-01-03T00:00:00Z',
            });

            await provider.addStep({
                number: 2,
                code: 'step-2',
                title: 'Second Step',
                status: 'in_progress',
                content: '# Second Step\n\nMore content.',
                startedAt: '2024-01-04T00:00:00Z',
            });

            const result = await renderPlanToMarkdown(provider);

            expect(result.steps.size).toBe(2);
            expect(result.steps.has('01-step-1.md')).toBe(true);
            expect(result.steps.has('02-step-2.md')).toBe(true);

            // Check STATUS.md includes step progress
            const status = result.files.get('STATUS.md')!;
            expect(status).toContain('First Step');
            expect(status).toContain('Second Step');
            expect(status).toContain('50%'); // 1/2 completed
        });

        it('should render evidence', async () => {
            await provider.addEvidence({
                id: 'evidence-1',
                description: 'Research findings',
                source: 'web search',
                sourceUrl: 'https://example.com',
                content: 'The research shows...',
                gatheringMethod: 'model-assisted',
                createdAt: '2024-01-01T00:00:00Z',
            });

            const result = await renderPlanToMarkdown(provider);

            expect(result.evidence.size).toBe(1);
            expect(result.evidence.has('evidence-1.md')).toBe(true);

            const evidence = result.evidence.get('evidence-1.md')!;
            expect(evidence).toContain('Research findings');
            expect(evidence).toContain('source: web search');
            expect(evidence).toContain('url: https://example.com');
            expect(evidence).toContain('The research shows...');
        });

        it('should render feedback', async () => {
            await provider.addFeedback({
                id: 'feedback-1',
                title: 'Code Review',
                content: 'The implementation looks solid.',
                platform: 'github',
                participants: ['alice', 'bob'],
                createdAt: '2024-01-05T00:00:00Z',
            });

            const result = await renderPlanToMarkdown(provider);

            expect(result.feedback.size).toBe(1);
            expect(result.feedback.has('feedback-1.md')).toBe(true);

            const feedback = result.feedback.get('feedback-1.md')!;
            expect(feedback).toContain('# Code Review');
            expect(feedback).toContain('platform: github');
            expect(feedback).toContain('participants: [alice, bob]');
            expect(feedback).toContain('The implementation looks solid.');
        });

        it('should include existing files', async () => {
            await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Original Idea\n\nThe concept.',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });

            const result = await renderPlanToMarkdown(provider);

            expect(result.files.has('IDEA.md')).toBe(true);
            expect(result.files.get('IDEA.md')).toContain('# Original Idea');
        });

        it('should respect includeEvidence option', async () => {
            await provider.addEvidence({
                id: 'evidence-1',
                description: 'Research',
                createdAt: '2024-01-01T00:00:00Z',
            });

            const withEvidence = await renderPlanToMarkdown(provider, { includeEvidence: true });
            expect(withEvidence.evidence.size).toBe(1);

            const withoutEvidence = await renderPlanToMarkdown(provider, { includeEvidence: false });
            expect(withoutEvidence.evidence.size).toBe(0);
        });

        it('should respect includeFeedback option', async () => {
            await provider.addFeedback({
                id: 'feedback-1',
                content: 'Notes',
                createdAt: '2024-01-01T00:00:00Z',
            });

            const withFeedback = await renderPlanToMarkdown(provider, { includeFeedback: true });
            expect(withFeedback.feedback.size).toBe(1);

            const withoutFeedback = await renderPlanToMarkdown(provider, { includeFeedback: false });
            expect(withoutFeedback.feedback.size).toBe(0);
        });

        it('should include source info when requested', async () => {
            const result = await renderPlanToMarkdown(provider, { includeSourceInfo: true });

            const summary = result.files.get('SUMMARY.md')!;
            expect(summary).toContain('Schema Version');
        });
    });

    describe('Status rendering', () => {
        it('should show correct progress percentage', async () => {
            await provider.addStep({ number: 1, code: 's1', title: 'S1', status: 'completed', content: '' });
            await provider.addStep({ number: 2, code: 's2', title: 'S2', status: 'completed', content: '' });
            await provider.addStep({ number: 3, code: 's3', title: 'S3', status: 'in_progress', content: '' });
            await provider.addStep({ number: 4, code: 's4', title: 'S4', status: 'pending', content: '' });

            const result = await renderPlanToMarkdown(provider);
            const status = result.files.get('STATUS.md')!;

            expect(status).toContain('50%'); // 2/4 completed
            expect(status).toContain('2/4');
        });

        it('should show correct status icons', async () => {
            await provider.addStep({ number: 1, code: 's1', title: 'Done', status: 'completed', content: '' });
            await provider.addStep({ number: 2, code: 's2', title: 'Working', status: 'in_progress', content: '' });
            await provider.addStep({ number: 3, code: 's3', title: 'Todo', status: 'pending', content: '' });

            const result = await renderPlanToMarkdown(provider);
            const status = result.files.get('STATUS.md')!;

            expect(status).toContain('✅'); // completed
            expect(status).toContain('🔄'); // in_progress
            expect(status).toContain('⬜'); // pending
        });
    });
});
