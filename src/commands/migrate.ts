/**
 * Migration command for converting plans to HTTP format
 */
/* eslint-disable no-console */

import { Command } from 'commander';
import { migrateToHttpFormat } from '../migration/migrate-to-http.js';
import { resolve } from 'node:path';

export function createMigrateCommand(): Command {
    const migrate = new Command('migrate');

    migrate
        .description('Migrate directory-based plans to UUID-based .plan format')
        .requiredOption('-s, --source <dir>', 'Source directory containing plans')
        .requiredOption('-t, --target <dir>', 'Target directory for .plan files')
        .option('--dry-run', 'Dry run - show what would be migrated without creating files')
        .option('-p, --project <slug>', 'Project slug to add to metadata (e.g., kjerneverk, redaksjon)')
        .action(async (options) => {
            const sourceDir = resolve(options.source);
            const targetDir = resolve(options.target);

            try {
                const result = await migrateToHttpFormat({
                    sourceDir,
                    targetDir,
                    dryRun: options.dryRun,
                    projectSlug: options.project,
                });

                if (!result.success) {
                    process.exit(1);
                }
            } catch (error) {
                console.error('Migration failed:', error);
                process.exit(1);
            }
        });

    return migrate;
}
