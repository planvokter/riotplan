import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadConfig: vi.fn(),
    loadConfiguredCatalysts: vi.fn(),
}));

vi.mock('../../../src/config/index.js', () => ({
    loadConfig: mocks.loadConfig,
    loadConfiguredCatalysts: mocks.loadConfiguredCatalysts,
}));

import { catalystTool } from '../../../src/mcp/tools/catalyst.js';

describe('catalyst list context resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadConfig.mockResolvedValue({
            catalysts: ['local-catalyst'],
        });
        mocks.loadConfiguredCatalysts.mockResolvedValue({
            catalystIds: ['local-catalyst'],
            contributions: new Map([
                [
                    'local-catalyst',
                    { facetTypes: ['questions'], contentCount: 1 },
                ],
            ]),
        });
    });

    it('uses tool execution workingDirectory as catalyst base path', async () => {
        const result = await catalystTool.execute(
            { action: 'list' },
            { workingDirectory: '/workspace/project-a' } as any
        );

        expect(result.success).toBe(true);
        expect(mocks.loadConfiguredCatalysts).toHaveBeenCalledWith(
            expect.anything(),
            '/workspace/project-a'
        );
    });
});
