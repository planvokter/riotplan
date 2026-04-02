import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readPlanManifest,
  writePlanManifest,
  updatePlanManifest,
  addCatalystToManifest,
  removeCatalystFromManifest,
} from '@/loader/plan-manifest';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'catalyst-'));
});

afterEach(async () => {
  try {
    await rmdir(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('Plan Manifest', () => {
  describe('readPlanManifest', () => {
    it('returns null for missing manifest', async () => {
      const manifest = await readPlanManifest(tempDir);
      expect(manifest).toBeNull();
    });

    it('reads a valid manifest', async () => {
      const original: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'my-plan',
        title: 'My Plan',
        catalysts: ['@test/catalyst-1'],
      };

      await writePlanManifest(tempDir, original);
      const read = await readPlanManifest(tempDir);

      expect(read).toBeDefined();
      expect(read?.id).toBe('my-plan');
      expect(read?.title).toBe('My Plan');
      expect(read?.catalysts).toEqual(['@test/catalyst-1']);
    });

    it('validates manifest schema', async () => {
      // Write invalid YAML manually
      const { writeFile } = await import('node:fs/promises');
      const manifestPath = join(tempDir, 'plan.yaml');
      
      // Missing required field
      await writeFile(manifestPath, 'title: "Only Title"', 'utf-8');

      await expect(readPlanManifest(tempDir)).rejects.toThrow('Invalid plan manifest');
    });

    it('includes created timestamp', async () => {
      const manifest: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'test-plan',
        title: 'Test',
      };

      await writePlanManifest(tempDir, manifest);
      const read = await readPlanManifest(tempDir);

      expect(read?.created).toBeDefined();
      expect(typeof read?.created).toBe('string');
      // Should be a valid ISO timestamp
      expect(new Date(read?.created || '').getTime()).not.toBeNaN();
    });
  });

  describe('writePlanManifest', () => {
    it('writes a valid manifest', async () => {
      const manifest: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'write-test',
        title: 'Write Test',
        catalysts: ['cat1', 'cat2'],
        metadata: { key: 'value' },
      };

      await writePlanManifest(tempDir, manifest);
      const read = await readPlanManifest(tempDir);

      expect(read?.id).toBe('write-test');
      expect(read?.title).toBe('Write Test');
      expect(read?.catalysts).toEqual(['cat1', 'cat2']);
      expect(read?.metadata?.key).toBe('value');
    });

    it('rejects invalid manifest', async () => {
      const invalid = {
        // Missing required 'title'
        id: 'test',
      };

      await expect(writePlanManifest(tempDir, invalid as any)).rejects.toThrow();
    });

    it('creates file in YAML format', async () => {
      const manifest: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'yaml-test',
        title: 'YAML Test',
      };

      await writePlanManifest(tempDir, manifest);

      const { readFileSync } = require('node:fs');
      const content = readFileSync(join(tempDir, 'plan.yaml'), 'utf-8');

      expect(content).toContain('id: yaml-test');
      expect(content).toContain('title: YAML Test');
    });
  });

  describe('updatePlanManifest', () => {
    it('creates new manifest if none exists', async () => {
      await updatePlanManifest(tempDir, {
        id: 'new-plan',
        title: 'New Plan',
      });

      const read = await readPlanManifest(tempDir);
      expect(read?.id).toBe('new-plan');
      expect(read?.title).toBe('New Plan');
    });

    it('updates specific fields', async () => {
      await writePlanManifest(tempDir, {
        id: 'original',
        title: 'Original Title',
        catalysts: ['cat1'],
      });

      await updatePlanManifest(tempDir, {
        title: 'Updated Title',
      });

      const read = await readPlanManifest(tempDir);
      expect(read?.id).toBe('original'); // Unchanged
      expect(read?.title).toBe('Updated Title'); // Updated
      expect(read?.catalysts).toEqual(['cat1']); // Preserved
    });

    it('merges fields without overwriting', async () => {
      await writePlanManifest(tempDir, {
        id: 'merge-test',
        title: 'Test',
        catalysts: ['cat1', 'cat2'],
        metadata: { existing: 'value' },
      });

      await updatePlanManifest(tempDir, {
        metadata: { new: 'field' },
      });

      const read = await readPlanManifest(tempDir);
      // Note: metadata is completely replaced, not merged
      expect(read?.metadata?.new).toBe('field');
      expect(read?.catalysts).toEqual(['cat1', 'cat2']);
    });

    it('requires id and title for new manifest', async () => {
      await expect(
        updatePlanManifest(tempDir, {
          catalysts: ['cat1'],
        })
      ).rejects.toThrow('Cannot create manifest without id and title');
    });
  });

  describe('addCatalystToManifest', () => {
    it('adds catalyst to existing manifest', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
        catalysts: ['cat1'],
      });

      await addCatalystToManifest(tempDir, 'cat2');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toEqual(['cat1', 'cat2']);
    });

    it('creates catalyst array if missing', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
      });

      await addCatalystToManifest(tempDir, 'cat1');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toEqual(['cat1']);
    });

    it('does not add duplicate catalysts', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
        catalysts: ['cat1'],
      });

      await addCatalystToManifest(tempDir, 'cat1');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toEqual(['cat1']);
    });
  });

  describe('removeCatalystFromManifest', () => {
    it('removes catalyst from manifest', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
        catalysts: ['cat1', 'cat2', 'cat3'],
      });

      await removeCatalystFromManifest(tempDir, 'cat2');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toEqual(['cat1', 'cat3']);
    });

    it('removes catalysts array if last one removed', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
        catalysts: ['cat1'],
      });

      await removeCatalystFromManifest(tempDir, 'cat1');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toBeUndefined();
    });

    it('does nothing if catalyst not found', async () => {
      await writePlanManifest(tempDir, {
        id: 'test',
        title: 'Test',
        catalysts: ['cat1'],
      });

      await removeCatalystFromManifest(tempDir, 'cat-nonexistent');

      const read = await readPlanManifest(tempDir);
      expect(read?.catalysts).toEqual(['cat1']);
    });
  });

  describe('roundtrip tests', () => {
    it('write and read preserve all fields', async () => {
      const original: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'roundtrip',
        title: 'Roundtrip Test',
        catalysts: ['@org/catalyst-1', '@org/catalyst-2'],
        metadata: { key1: 'value1', key2: 'value2' },
        created: '2026-02-08T12:00:00Z',
      };

      await writePlanManifest(tempDir, original);
      const read = await readPlanManifest(tempDir);

      expect(read?.id).toBe(original.id);
      expect(read?.title).toBe(original.title);
      expect(read?.catalysts).toEqual(original.catalysts);
      expect(read?.metadata).toEqual(original.metadata);
      expect(read?.created).toBe(original.created);
    });

    it('multiple updates preserve data', async () => {
      const manifest: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'multi-update',
        title: 'Multi Update',
      };

      await writePlanManifest(tempDir, manifest);
      await addCatalystToManifest(tempDir, 'cat1');
      await addCatalystToManifest(tempDir, 'cat2');
      await updatePlanManifest(tempDir, { metadata: { step: '1' } });

      const read = await readPlanManifest(tempDir);
      expect(read?.id).toBe('multi-update');
      expect(read?.catalysts).toEqual(['cat1', 'cat2']);
      expect(read?.metadata?.step).toBe('1');
    });
  });

  describe('backward compatibility', () => {
    it('handles missing manifest gracefully', async () => {
      const manifest = await readPlanManifest(tempDir);
      expect(manifest).toBeNull();
      // Should not throw
    });

    it('plans without catalysts work fine', async () => {
      const manifest: typeof import('@/loader/plan-manifest').PlanManifest = {
        id: 'no-catalysts',
        title: 'No Catalysts',
      };

      await writePlanManifest(tempDir, manifest);
      const read = await readPlanManifest(tempDir);

      expect(read?.id).toBe('no-catalysts');
      expect(read?.catalysts).toBeUndefined();
    });
  });
});
