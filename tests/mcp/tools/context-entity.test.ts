import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../../src/mcp/types.js';

const { createContextMock } = vi.hoisted(() => ({
    createContextMock: vi.fn(),
}));

vi.mock('@redaksjon/context', () => ({
    create: createContextMock,
}));

import { contextEntityTool } from '../../../src/mcp/tools/context-entity.js';

function makeExecutionContext(): ToolExecutionContext {
    return {
        workingDirectory: '/workspace/plans',
        session: null,
        mcpServer: null as any,
        sendNotification: async () => {},
    };
}

function makeContextMock(overrides: Record<string, unknown> = {}) {
    return {
        getAllProjects: vi.fn(() => []),
        getAllPeople: vi.fn(() => []),
        getAllTerms: vi.fn(() => []),
        getAllCompanies: vi.fn(() => []),
        getAllIgnored: vi.fn(() => []),
        getProject: vi.fn(() => undefined),
        getPerson: vi.fn(() => undefined),
        getTerm: vi.fn(() => undefined),
        getCompany: vi.fn(() => undefined),
        getIgnored: vi.fn(() => undefined),
        saveEntity: vi.fn(async () => {}),
        deleteEntity: vi.fn(async () => true),
        ...overrides,
    };
}

describe('riotplan_context tool', () => {
    beforeEach(() => {
        createContextMock.mockReset();
    });

    it('lists projects and excludes inactive by default', async () => {
        const mockCtx = makeContextMock({
            getAllProjects: vi.fn(() => [
                { id: 'alpha', type: 'project', active: true },
                { id: 'beta', type: 'project', active: false },
            ]),
        });
        createContextMock.mockResolvedValue(mockCtx);

        const result = await contextEntityTool.execute(
            { action: 'list', entityType: 'project' },
            makeExecutionContext()
        );

        expect(result.success).toBe(true);
        expect(result.data.count).toBe(1);
        expect(result.data.entities.map((e: any) => e.id)).toEqual(['alpha']);
    });

    it('supports get action for a typed entity id', async () => {
        const mockCtx = makeContextMock({
            getProject: vi.fn((id: string) => (id === 'alpha' ? { id: 'alpha', type: 'project' } : undefined)),
        });
        createContextMock.mockResolvedValue(mockCtx);

        const result = await contextEntityTool.execute(
            { action: 'get', entityType: 'project', id: 'alpha' },
            makeExecutionContext()
        );

        expect(result.success).toBe(true);
        expect(result.data.entity.id).toBe('alpha');
    });

    it('creates an entity and enforces type/id', async () => {
        const mockCtx = makeContextMock();
        createContextMock.mockResolvedValue(mockCtx);

        const result = await contextEntityTool.execute(
            {
                action: 'create',
                entityType: 'project',
                entity: { id: 'new-project', name: 'New Project' },
            },
            makeExecutionContext()
        );

        expect(result.success).toBe(true);
        expect(mockCtx.saveEntity).toHaveBeenCalledTimes(1);
        const payload = mockCtx.saveEntity.mock.calls[0][0];
        expect(payload.id).toBe('new-project');
        expect(payload.type).toBe('project');
    });

    it('updates an existing entity with partial changes', async () => {
        const mockCtx = makeContextMock({
            getProject: vi.fn(() => ({
                id: 'alpha',
                type: 'project',
                name: 'Alpha',
                active: true,
            })),
        });
        createContextMock.mockResolvedValue(mockCtx);

        const result = await contextEntityTool.execute(
            {
                action: 'update',
                entityType: 'project',
                id: 'alpha',
                changes: { name: 'Alpha 2' },
            },
            makeExecutionContext()
        );

        expect(result.success).toBe(true);
        expect(mockCtx.saveEntity).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'alpha',
                type: 'project',
                name: 'Alpha 2',
            }),
            true
        );
    });

    it('deletes an entity by type and id', async () => {
        const mockCtx = makeContextMock({
            getProject: vi.fn(() => ({ id: 'alpha', type: 'project' })),
        });
        createContextMock.mockResolvedValue(mockCtx);

        const result = await contextEntityTool.execute(
            {
                action: 'delete',
                entityType: 'project',
                id: 'alpha',
            },
            makeExecutionContext()
        );

        expect(result.success).toBe(true);
        expect(result.data.deleted).toBe(true);
        expect(mockCtx.deleteEntity).toHaveBeenCalledTimes(1);
    });

    it('resolves contextDirectory and contextDirectories from working directory', async () => {
        const mockCtx = makeContextMock();
        createContextMock.mockResolvedValue(mockCtx);

        await contextEntityTool.execute(
            {
                action: 'list',
                entityType: 'term',
                contextDirectory: '../ctx-root',
                contextDirectories: ['./.protokoll'],
            },
            makeExecutionContext()
        );

        expect(createContextMock).toHaveBeenCalledWith({
            startingDir: '/workspace/ctx-root',
            contextDirectories: ['/workspace/plans/.protokoll'],
        });
    });
});
