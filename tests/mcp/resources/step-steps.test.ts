import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const provider = {
        getMetadata: vi.fn(),
        getStep: vi.fn(),
        getSteps: vi.fn(),
        close: vi.fn(async () => undefined),
    };
    return {
        provider,
        createSqliteProvider: vi.fn(() => provider),
    };
});

vi.mock('@kjerneverk/riotplan-format', () => ({
    createSqliteProvider: mocks.createSqliteProvider,
}));

import { readStepResource } from '../../../src/mcp/resources/step.js';
import { readStepsResource } from '../../../src/mcp/resources/steps.js';

describe('step/steps resources', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createSqliteProvider.mockReturnValue(mocks.provider);
    });

    it('rejects directory paths for step resource', async () => {
        await expect(readStepResource('/tmp/dir-plan', 1)).rejects.toThrow(
            'Failed to read step 1: Error: Directory-based plans are no longer supported.'
        );
    });

    it('rejects directory paths for steps resource', async () => {
        await expect(readStepsResource('/tmp/dir-plan')).rejects.toThrow(
            'Failed to read steps: Error: Directory-based plans are no longer supported.'
        );
    });

    it('returns step content with fallback filename segment', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-a' } });
        mocks.provider.getStep.mockResolvedValueOnce({
            success: true,
            data: { number: 2, title: 'T', status: 'pending', code: '', content: undefined },
        });

        const result = await readStepResource('/tmp/a.plan', 2);
        expect(result.planId).toBe('plan-a');
        expect(result.file).toBe('02-step.md');
        expect(result.content).toBe('');
    });

    it('throws when metadata lookup fails for step resource', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: false, error: 'meta fail' });
        mocks.provider.getStep.mockResolvedValueOnce({ success: true, data: { number: 1 } });

        await expect(readStepResource('/tmp/a.plan', 1)).rejects.toThrow(
            'Failed to read step 1: Error: meta fail'
        );
    });

    it('throws when requested step does not exist', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-a' } });
        mocks.provider.getStep.mockResolvedValueOnce({ success: false, data: null });

        await expect(readStepResource('/tmp/a.plan', 9)).rejects.toThrow(
            'Failed to read step 9: Error: Step 9 not found in plan'
        );
    });

    it('maps steps list and defaults empty array on steps failure', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-b' } });
        mocks.provider.getSteps.mockResolvedValueOnce({ success: false, error: 'steps fail' });

        const result = await readStepsResource('/tmp/b.plan');
        expect(result.planId).toBe('plan-b');
        expect(result.steps).toEqual([]);
    });

    it('maps step filenames with padded number + code fallback', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-c' } });
        mocks.provider.getSteps.mockResolvedValueOnce({
            success: true,
            data: [
                { number: 1, title: 'One', status: 'pending', code: 'custom' },
                { number: 10, title: 'Two', status: 'completed', code: '' },
            ],
        });

        const result = await readStepsResource('/tmp/c.plan');
        expect(result.steps[0].file).toBe('01-custom.md');
        expect(result.steps[1].file).toBe('10-step.md');
    });

    it('throws when metadata lookup fails for steps resource', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: false, error: 'meta fail' });
        mocks.provider.getSteps.mockResolvedValueOnce({ success: true, data: [] });

        await expect(readStepsResource('/tmp/c.plan')).rejects.toThrow(
            'Failed to read steps: Error: meta fail'
        );
    });
});
