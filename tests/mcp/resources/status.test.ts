import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const provider = {
        getMetadata: vi.fn(),
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

import { readStatusResource } from '../../../src/mcp/resources/status.js';

describe('readStatusResource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createSqliteProvider.mockReturnValue(mocks.provider);
    });

    it('rejects directory-based paths', async () => {
        await expect(readStatusResource('/tmp/not-a-sqlite-plan')).rejects.toThrow(
            'Failed to read status: Error: Directory-based plans are no longer supported.'
        );
    });

    it('throws when metadata lookup fails', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: false, error: 'metadata failed' });
        mocks.provider.getSteps.mockResolvedValueOnce({ success: true, data: [] });
        await expect(readStatusResource('/tmp/a.plan')).rejects.toThrow('Failed to read status: Error: metadata failed');
        expect(mocks.provider.close).toHaveBeenCalled();
    });

    it('returns in_progress status when a step is actively running', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-a' } });
        mocks.provider.getSteps.mockResolvedValueOnce({
            success: true,
            data: [
                { number: 1, status: 'completed' },
                { number: 2, status: 'in_progress' },
                { number: 3, status: 'pending' },
            ],
        });

        const result = await readStatusResource('/tmp/a.plan');
        expect(result.planId).toBe('plan-a');
        expect(result.status).toBe('in_progress');
        expect(result.currentStep).toBe(2);
        expect(result.lastCompleted).toBe(1);
        expect(result.progress).toEqual({ completed: 1, total: 3, percentage: 33 });
    });

    it('returns completed status when all steps are done/skipped', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-b' } });
        mocks.provider.getSteps.mockResolvedValueOnce({
            success: true,
            data: [
                { number: 1, status: 'completed' },
                { number: 2, status: 'skipped' },
            ],
        });

        const result = await readStatusResource('/tmp/b.plan');
        expect(result.status).toBe('completed');
        expect(result.currentStep).toBeUndefined();
        expect(result.lastCompleted).toBe(2);
        expect(result.progress).toEqual({ completed: 2, total: 2, percentage: 100 });
    });

    it('returns pending status and next pending step when nothing is in progress', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-c' } });
        mocks.provider.getSteps.mockResolvedValueOnce({
            success: true,
            data: [
                { number: 1, status: 'pending' },
                { number: 2, status: 'pending' },
            ],
        });

        const result = await readStatusResource('/tmp/c.plan');
        expect(result.status).toBe('pending');
        expect(result.currentStep).toBe(1);
        expect(result.lastCompleted).toBeUndefined();
        expect(result.progress).toEqual({ completed: 0, total: 2, percentage: 0 });
    });

    it('handles empty or failed step queries', async () => {
        mocks.provider.getMetadata.mockResolvedValueOnce({ success: true, data: { id: 'plan-d' } });
        mocks.provider.getSteps.mockResolvedValueOnce({ success: false, error: 'step read failed' });

        const result = await readStatusResource('/tmp/d.plan');
        expect(result.status).toBe('pending');
        expect(result.currentStep).toBeUndefined();
        expect(result.lastCompleted).toBeUndefined();
        expect(result.progress).toEqual({ completed: 0, total: 0, percentage: 0 });
    });
});
