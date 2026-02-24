import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    readPlanResource: vi.fn(async () => ({ ok: 'plan' })),
    readStatusResource: vi.fn(async () => ({ ok: 'status' })),
    readStepsResource: vi.fn(async () => ({ ok: 'steps' })),
    readStepResource: vi.fn(async () => ({ ok: 'step' })),
    readIdeaResource: vi.fn(async () => ({ ok: 'idea' })),
    readTimelineResource: vi.fn(async () => ({ ok: 'timeline' })),
    readPromptsListResource: vi.fn(async () => ({ ok: 'prompts' })),
    readPromptResource: vi.fn(async () => ({ ok: 'prompt' })),
    readEvidenceListResource: vi.fn(async () => ({ ok: 'evidence' })),
    readEvidenceResource: vi.fn(async () => ({ ok: 'evidence-file' })),
    readShapingResource: vi.fn(async () => ({ ok: 'shaping' })),
    readCheckpointsListResource: vi.fn(async () => ({ ok: 'checkpoints' })),
    readCheckpointResource: vi.fn(async () => ({ ok: 'checkpoint' })),
    readArtifactResource: vi.fn(async () => ({ ok: 'artifact' })),
    resolveDirectory: vi.fn(() => '/resolved/path.plan'),
    parseUri: vi.fn(),
}));

vi.mock('../../../src/mcp/resources/plan.js', () => ({ readPlanResource: mocks.readPlanResource }));
vi.mock('../../../src/mcp/resources/status.js', () => ({ readStatusResource: mocks.readStatusResource }));
vi.mock('../../../src/mcp/resources/steps.js', () => ({ readStepsResource: mocks.readStepsResource }));
vi.mock('../../../src/mcp/resources/step.js', () => ({ readStepResource: mocks.readStepResource }));
vi.mock('../../../src/mcp/resources/idea.js', () => ({ readIdeaResource: mocks.readIdeaResource }));
vi.mock('../../../src/mcp/resources/timeline.js', () => ({ readTimelineResource: mocks.readTimelineResource }));
vi.mock('../../../src/mcp/resources/prompts.js', () => ({
    readPromptsListResource: mocks.readPromptsListResource,
    readPromptResource: mocks.readPromptResource,
}));
vi.mock('../../../src/mcp/resources/evidence.js', () => ({
    readEvidenceListResource: mocks.readEvidenceListResource,
    readEvidenceResource: mocks.readEvidenceResource,
}));
vi.mock('../../../src/mcp/resources/shaping.js', () => ({ readShapingResource: mocks.readShapingResource }));
vi.mock('../../../src/mcp/resources/checkpoints.js', () => ({
    readCheckpointsListResource: mocks.readCheckpointsListResource,
    readCheckpointResource: mocks.readCheckpointResource,
}));
vi.mock('../../../src/mcp/resources/artifact.js', () => ({ readArtifactResource: mocks.readArtifactResource }));
vi.mock('../../../src/mcp/tools/shared.js', () => ({ resolveDirectory: mocks.resolveDirectory }));
vi.mock('../../../src/mcp/uri.js', () => ({ parseUri: mocks.parseUri }));

import { getResources, readResource } from '../../../src/mcp/resources/index.js';

describe('mcp resource index', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolveDirectory.mockReturnValue('/resolved/path.plan');
    });

    it('returns resource metadata including artifact/checkpoint resources', () => {
        const resources = getResources();
        const uris = resources.map((r) => r.uri);
        expect(uris).toContain('riotplan://artifact/{planId}?type={type}');
        expect(uris).toContain('riotplan://checkpoint/{planId}?name={name}');
        expect(uris).toContain('riotplan://checkpoints/{planId}');
    });

    it('routes known resource types to appropriate handlers', async () => {
        const cases = [
            { type: 'plan', query: undefined, expectFn: mocks.readPlanResource },
            { type: 'status', query: undefined, expectFn: mocks.readStatusResource },
            { type: 'steps', query: undefined, expectFn: mocks.readStepsResource },
            { type: 'step', query: { number: '2' }, expectFn: mocks.readStepResource },
            { type: 'idea', query: undefined, expectFn: mocks.readIdeaResource },
            { type: 'execution-plan', query: undefined, expectFn: mocks.readArtifactResource },
            { type: 'summary', query: undefined, expectFn: mocks.readArtifactResource },
            { type: 'provenance', query: undefined, expectFn: mocks.readArtifactResource },
            { type: 'artifact', query: { type: 'status' }, expectFn: mocks.readArtifactResource },
            { type: 'timeline', query: undefined, expectFn: mocks.readTimelineResource },
            { type: 'history', query: undefined, expectFn: mocks.readTimelineResource },
            { type: 'prompts', query: undefined, expectFn: mocks.readPromptsListResource },
            { type: 'prompt', query: { file: 'x.md' }, expectFn: mocks.readPromptResource },
            { type: 'evidence', query: undefined, expectFn: mocks.readEvidenceListResource },
            { type: 'evidence-file', query: { file: 'x.md' }, expectFn: mocks.readEvidenceResource },
            { type: 'shaping', query: undefined, expectFn: mocks.readShapingResource },
            { type: 'checkpoints', query: undefined, expectFn: mocks.readCheckpointsListResource },
            { type: 'checkpoint', query: { name: 'snap-1' }, expectFn: mocks.readCheckpointResource },
        ] as const;

        for (const c of cases) {
            mocks.parseUri.mockReturnValueOnce({ type: c.type, path: 'demo', query: c.query });
            await readResource(`riotplan://${c.type}/demo`, '/plans-root');
            expect(c.expectFn).toHaveBeenCalled();
        }
    });

    it('requires step number for step resources', async () => {
        mocks.parseUri.mockReturnValue({ type: 'step', path: 'demo', query: undefined });
        await expect(readResource('riotplan://step/demo')).rejects.toThrow('Step number is required');
    });

    it('requires artifact type for artifact resources', async () => {
        mocks.parseUri.mockReturnValue({ type: 'artifact', path: 'demo', query: undefined });
        await expect(readResource('riotplan://artifact/demo')).rejects.toThrow('Artifact type is required');
    });

    it('requires file name for prompt and evidence-file resources', async () => {
        mocks.parseUri.mockReturnValueOnce({ type: 'prompt', path: 'demo', query: {} });
        await expect(readResource('riotplan://prompt/demo')).rejects.toThrow('File name is required');

        mocks.parseUri.mockReturnValueOnce({ type: 'evidence-file', path: 'demo', query: {} });
        await expect(readResource('riotplan://evidence-file/demo')).rejects.toThrow('File name is required');
    });

    it('requires checkpoint name for checkpoint resources', async () => {
        mocks.parseUri.mockReturnValue({ type: 'checkpoint', path: 'demo', query: {} });
        await expect(readResource('riotplan://checkpoint/demo')).rejects.toThrow('Checkpoint name is required');
    });

    it('throws on unknown resource type', async () => {
        mocks.parseUri.mockReturnValue({ type: 'unknown', path: 'demo', query: undefined });
        await expect(readResource('riotplan://unknown/demo')).rejects.toThrow('Unknown resource type');
    });
});
