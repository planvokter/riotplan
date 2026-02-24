import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const provider = {
        getEvidence: vi.fn(),
        close: vi.fn(async () => undefined),
    };
    return { provider };
});

vi.mock('@kjerneverk/riotplan-format', () => ({
    createSqliteProvider: vi.fn(() => mocks.provider),
}));

import { readEvidenceListResource, readEvidenceResource } from '../../../src/mcp/resources/evidence.js';

describe('evidence resources sqlite error branches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when sqlite evidence listing fails', async () => {
        mocks.provider.getEvidence.mockResolvedValueOnce({
            success: false,
            error: 'db down',
        });

        await expect(readEvidenceListResource('/tmp/test.plan')).rejects.toThrow('db down');
        expect(mocks.provider.close).toHaveBeenCalled();
    });

    it('maps sqlite records with missing filePath/content fields', async () => {
        mocks.provider.getEvidence.mockResolvedValueOnce({
            success: true,
            data: [{ id: 'ev_1', createdAt: '2026-01-01T00:00:00.000Z' }],
        });

        const result = await readEvidenceListResource('/tmp/test.plan');
        expect(result.evidence[0]).toEqual({
            name: 'ev_1',
            size: 0,
            modified: '2026-01-01T00:00:00.000Z',
        });
    });

    it('throws when sqlite evidence read fails or data is missing', async () => {
        mocks.provider.getEvidence.mockResolvedValueOnce({
            success: false,
            error: 'unavailable',
        });
        await expect(readEvidenceResource('/tmp/test.plan', 'ev_1')).rejects.toThrow('unavailable');

        mocks.provider.getEvidence.mockResolvedValueOnce({
            success: true,
            data: [],
        });
        await expect(readEvidenceResource('/tmp/test.plan', 'ev_2')).rejects.toThrow(
            'Evidence file not found: ev_2'
        );
    });

    it('uses summary when content is empty in sqlite records', async () => {
        mocks.provider.getEvidence.mockResolvedValueOnce({
            success: true,
            data: [
                {
                    id: 'ev_3',
                    filePath: 'ev-3.json',
                    content: '',
                    summary: '{"title":"Fallback summary"}',
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ],
        });

        const detail = await readEvidenceResource('/tmp/test.plan', 'ev_3');
        expect(detail.content).toContain('Fallback summary');
        expect(detail.record.file).toBe('ev-3.json');
    });
});
