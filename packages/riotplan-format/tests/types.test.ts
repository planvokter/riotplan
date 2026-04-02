/**
 * Type tests for riotplan-format
 * 
 * These tests verify that the type definitions are correct and usable.
 */

import { describe, it, expect } from 'vitest';
import type {
    StorageFormat,
    PlanMetadata,
    PlanStep,
    PlanFile,
    TimelineEvent,
    PlanStage,
    StepStatus,
    PlanFileType,
    TimelineEventType,
} from '../src/types.js';

describe('Type definitions', () => {
    describe('StorageFormat', () => {
        it('should accept valid storage formats', () => {
            const directory: StorageFormat = 'directory';
            const sqlite: StorageFormat = 'sqlite';
            
            expect(directory).toBe('directory');
            expect(sqlite).toBe('sqlite');
        });
    });

    describe('PlanMetadata', () => {
        it('should accept valid plan metadata', () => {
            const metadata: PlanMetadata = {
                id: 'test-plan',
                name: 'Test Plan',
                description: 'A test plan',
                createdAt: '2026-02-12T00:00:00.000Z',
                updatedAt: '2026-02-12T00:00:00.000Z',
                stage: 'idea',
                schemaVersion: 1,
            };

            expect(metadata.id).toBe('test-plan');
            expect(metadata.stage).toBe('idea');
        });

        it('should accept all valid plan stages', () => {
            const stages: PlanStage[] = [
                'idea',
                'shaping',
                'built',
                'executing',
                'completed',
                'cancelled',
            ];

            expect(stages).toHaveLength(6);
        });
    });

    describe('PlanStep', () => {
        it('should accept valid plan step', () => {
            const step: PlanStep = {
                number: 1,
                code: 'first-step',
                title: 'First Step',
                description: 'The first step',
                status: 'pending',
                content: '# First Step\n\nContent here...',
            };

            expect(step.number).toBe(1);
            expect(step.status).toBe('pending');
        });

        it('should accept all valid step statuses', () => {
            const statuses: StepStatus[] = [
                'pending',
                'in_progress',
                'completed',
                'skipped',
            ];

            expect(statuses).toHaveLength(4);
        });
    });

    describe('PlanFile', () => {
        it('should accept valid plan file', () => {
            const file: PlanFile = {
                type: 'idea',
                filename: 'IDEA.md',
                content: '# Idea\n\nContent...',
                createdAt: '2026-02-12T00:00:00.000Z',
                updatedAt: '2026-02-12T00:00:00.000Z',
            };

            expect(file.type).toBe('idea');
            expect(file.filename).toBe('IDEA.md');
        });

        it('should accept all valid file types', () => {
            const types: PlanFileType[] = [
                'idea',
                'shaping',
                'summary',
                'execution_plan',
                'status',
                'provenance',
                'lifecycle',
                'evidence',
                'feedback',
                'prompt',
                'reflection',
                'other',
            ];

            expect(types).toHaveLength(12);
        });
    });

    describe('TimelineEvent', () => {
        it('should accept valid timeline event', () => {
            const event: TimelineEvent = {
                id: 'event-1',
                timestamp: '2026-02-12T00:00:00.000Z',
                type: 'plan_created',
                data: { code: 'test-plan' },
            };

            expect(event.type).toBe('plan_created');
        });

        it('should accept all valid event types', () => {
            const types: TimelineEventType[] = [
                'plan_created',
                'stage_transition',
                'step_started',
                'step_completed',
                'note_added',
                'constraint_added',
                'question_added',
                'evidence_added',
                'approach_added',
                'approach_selected',
                'feedback_added',
                'checkpoint_created',
                'narrative_added',
                'reflection_added',
            ];

            expect(types).toHaveLength(14);
        });
    });
});

describe('Module exports', () => {
    it('should export VERSION and SCHEMA_VERSION', async () => {
        const { VERSION, SCHEMA_VERSION } = await import('../src/index.js');
        
        expect(VERSION).toBeDefined();
        expect(typeof VERSION).toBe('string');
        expect(SCHEMA_VERSION).toBeDefined();
        expect(typeof SCHEMA_VERSION).toBe('number');
    });
});
