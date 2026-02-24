import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    migrateToHttpFormat: vi.fn(),
    exit: vi.fn(),
}));

vi.mock('../../src/migration/migrate-to-http.js', () => ({
    migrateToHttpFormat: mocks.migrateToHttpFormat,
}));

import { createMigrateCommand } from '../../src/commands/migrate.js';

describe('createMigrateCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('process', { ...process, exit: mocks.exit });
    });

    it('calls migrate utility with resolved options', async () => {
        mocks.migrateToHttpFormat.mockResolvedValueOnce({ success: true });
        const command = createMigrateCommand();
        await command.parseAsync(
            ['node', 'riotplan', '--source', './plans', '--target', './out', '--project', 'kjerneverk', '--dry-run'],
            { from: 'node' }
        );
        expect(mocks.migrateToHttpFormat).toHaveBeenCalledTimes(1);
        expect(mocks.exit).not.toHaveBeenCalled();
    });

    it('exits with code 1 when migration result is unsuccessful', async () => {
        mocks.migrateToHttpFormat.mockResolvedValueOnce({ success: false });
        const command = createMigrateCommand();
        await command.parseAsync(['node', 'riotplan', '--source', './plans', '--target', './out'], { from: 'node' });
        expect(mocks.exit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when migration throws', async () => {
        mocks.migrateToHttpFormat.mockRejectedValueOnce(new Error('boom'));
        const command = createMigrateCommand();
        await command.parseAsync(['node', 'riotplan', '--source', './plans', '--target', './out'], { from: 'node' });
        expect(mocks.exit).toHaveBeenCalledWith(1);
    });
});
