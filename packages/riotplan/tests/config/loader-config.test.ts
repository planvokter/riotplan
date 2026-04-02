import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const read = vi.fn();
    const validate = vi.fn();
    return {
        create: vi.fn(() => ({ read, validate })),
        read,
        validate,
    };
});

vi.mock('@utilarium/cardigantime', () => ({
    create: mocks.create,
}));

import { clearConfigCache, loadConfig } from '../../src/config/loader.js';

describe('config loader error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearConfigCache();
    });

    it('returns null when read reports missing config', async () => {
        mocks.read.mockRejectedValueOnce(new Error('config file not found'));
        const result = await loadConfig();
        expect(result).toBeNull();
    });

    it('returns validated config and caches result', async () => {
        mocks.read.mockResolvedValueOnce({ planDirectory: './plans' });
        mocks.validate.mockResolvedValueOnce(undefined);

        const first = await loadConfig();
        const second = await loadConfig();
        expect(first).toEqual({ planDirectory: './plans' });
        expect(second).toEqual({ planDirectory: './plans' });
        expect(mocks.read).toHaveBeenCalledTimes(1);
    });

    it('throws detailed parse error message', async () => {
        mocks.read.mockRejectedValueOnce(new Error('JSON parse failed at line 1'));
        await expect(loadConfig()).rejects.toThrow('Failed to parse RiotPlan configuration file');
    });

    it('throws detailed validation error message', async () => {
        mocks.read.mockRejectedValueOnce(new Error('schema validation failed'));
        await expect(loadConfig()).rejects.toThrow('RiotPlan configuration validation failed');
    });

    it('wraps unknown errors with generic context', async () => {
        mocks.read.mockRejectedValueOnce(new Error('permission denied'));
        await expect(loadConfig()).rejects.toThrow('Failed to load RiotPlan configuration');
    });
});
