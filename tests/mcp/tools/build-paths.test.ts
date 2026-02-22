import { describe, it, expect } from 'vitest';
import { normalizeStepFilePaths } from '../../../src/mcp/tools/build.js';

describe('normalizeStepFilePaths', () => {
    it('normalizes absolute paths to project-relative paths', () => {
        const basePath = '/workspace/project';
        const paths = [
            '/workspace/project/src/index.ts',
            '/workspace/project/src/lib/util.ts',
        ];

        const result = normalizeStepFilePaths(paths, basePath);
        expect(result).toEqual(['src/index.ts', 'src/lib/util.ts']);
    });

    it('normalizes markdown-like path entries and deduplicates', () => {
        const basePath = '/workspace/project';
        const paths = [
            '- `/workspace/project/src/index.ts`',
            '`/workspace/project/src/index.ts`',
            '"src/lib/util.ts"',
        ];

        const result = normalizeStepFilePaths(paths, basePath);
        expect(result).toEqual(['src/index.ts', 'src/lib/util.ts']);
    });

    it('keeps already-relative paths relative', () => {
        const basePath = '/workspace/project';
        const paths = ['src/app.ts', './src/feature.ts'];

        const result = normalizeStepFilePaths(paths, basePath);
        expect(result).toEqual(['src/app.ts', 'src/feature.ts']);
    });
});
