import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readEvidenceListResource, readEvidenceResource } from '../../../src/mcp/resources/evidence.js';

describe('evidence resources', () => {
    let root: string;
    let planPath: string;
    let sqlitePlanPath: string;

    beforeEach(async () => {
        root = join(tmpdir(), `riotplan-evidence-res-${Date.now()}`);
        planPath = join(root, 'plan-a');
        sqlitePlanPath = join(root, 'plan-b.plan');
        await mkdir(planPath, { recursive: true });
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('returns empty list when evidence directory is missing', async () => {
        const result = await readEvidenceListResource(planPath);
        expect(result.count).toBe(0);
        expect(result.note).toContain('No evidence directory');
    });

    it('lists and reads filesystem evidence with embedded metadata', async () => {
        const evidenceDir = join(planPath, 'evidence');
        await mkdir(evidenceDir, { recursive: true });
        const content = `# notes

<!-- riotplan-evidence-record
{"file":"item.md","sources":["https://example.com/doc","./local/file.md"]}
-->
Body`;
        await writeFile(join(evidenceDir, 'item.md'), content, 'utf-8');

        const list = await readEvidenceListResource(planPath);
        expect(list.count).toBe(1);
        expect(list.evidence[0].name).toBe('item.md');

        const detail = await readEvidenceResource(planPath, 'item.md');
        expect(detail.record.file).toBe('item.md');
        expect(detail.record.referenceSources).toHaveLength(2);
        expect(detail.record.referenceSources[0].type).toBe('url');
        expect(detail.record.referenceSources[1].type).toBe('filepath');
    });

    it('reads sqlite evidence by id and by file path', async () => {
        const provider = createSqliteProvider(sqlitePlanPath);
        const now = new Date().toISOString();
        await provider.initialize({
            id: 'plan-b',
            uuid: '00000000-0000-4000-8000-000000000321',
            name: 'plan-b',
            stage: 'idea',
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.addEvidence({
            id: 'ev_1',
            filePath: 'ev-1.json',
            description: 'test',
            content: JSON.stringify({
                title: 'Evidence',
                sources: ['https://example.com/a', 'notes: meeting'],
            }),
            createdAt: now,
        });
        await provider.close();

        const list = await readEvidenceListResource(sqlitePlanPath);
        expect(list.count).toBe(1);

        const byId = await readEvidenceResource(sqlitePlanPath, 'ev_1');
        expect(byId.file).toBe('ev_1');
        expect(byId.record.referenceSources).toHaveLength(2);
        expect(byId.record.referenceSources[0].type).toBe('url');
        expect(byId.record.referenceSources[1].type).toBe('other');

        const byFile = await readEvidenceResource(sqlitePlanPath, 'ev-1.json');
        expect(byFile.record.file).toBe('ev-1.json');
    });

    it('throws a helpful error when evidence file does not exist', async () => {
        await expect(readEvidenceResource(planPath, 'missing.md')).rejects.toThrow(
            'Evidence file not found: missing.md'
        );
    });

    it('parses plain text evidence without metadata using defaults', async () => {
        const evidenceDir = join(planPath, 'evidence');
        await mkdir(evidenceDir, { recursive: true });
        await writeFile(join(evidenceDir, 'plain.md'), 'just text', 'utf-8');

        const detail = await readEvidenceResource(planPath, 'plain.md');
        expect(detail.record.file).toBe('plain.md');
        expect(detail.record.sources).toEqual([]);
        expect(detail.record.referenceSources).toEqual([]);
    });

    it('handles malformed embedded metadata safely', async () => {
        const evidenceDir = join(planPath, 'evidence');
        await mkdir(evidenceDir, { recursive: true });

        await writeFile(
            join(evidenceDir, 'broken-1.md'),
            '<!-- riotplan-evidence-record {"sources":["https://example.com"]',
            'utf-8'
        );
        const brokenOne = await readEvidenceResource(planPath, 'broken-1.md');
        expect(brokenOne.record.sources).toEqual([]);

        await writeFile(
            join(evidenceDir, 'broken-2.md'),
            '<!-- riotplan-evidence-record -->\nText',
            'utf-8'
        );
        const brokenTwo = await readEvidenceResource(planPath, 'broken-2.md');
        expect(brokenTwo.record.sources).toEqual([]);
    });

    it('rethrows non-ENOENT filesystem errors for list/read operations', async () => {
        await writeFile(join(planPath, 'evidence'), 'not-a-directory', 'utf-8');
        await expect(readEvidenceListResource(planPath)).rejects.toThrow();

        const plan2 = join(root, 'plan-c');
        await mkdir(join(plan2, 'evidence', 'dir-item'), { recursive: true });
        await expect(readEvidenceResource(plan2, 'dir-item')).rejects.toThrow();
    });
});
