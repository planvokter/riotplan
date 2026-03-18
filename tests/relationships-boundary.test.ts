import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walkFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkFiles(fullPath)));
            continue;
        }
        if (entry.isFile() && fullPath.endsWith('.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('relationships runtime boundary', () => {
    it('keeps relationships module out of MCP and CLI command runtime paths', async () => {
        const roots = [
            join(process.cwd(), 'src', 'mcp'),
            join(process.cwd(), 'src', 'commands'),
        ];
        const disallowedImports: string[] = [];

        for (const root of roots) {
            const files = await walkFiles(root);
            for (const filePath of files) {
                const content = await readFile(filePath, 'utf-8');
                if (content.includes('/relationships/index')) {
                    disallowedImports.push(filePath);
                }
            }
        }

        expect(disallowedImports).toEqual([]);
    });
});
