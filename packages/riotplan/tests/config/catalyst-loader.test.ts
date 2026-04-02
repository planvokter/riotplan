/**
 * Tests for catalyst loading and configuration integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConfiguredCatalysts,
  clearCatalystCache,
  getCatalystEnvOverrides,
} from '../../src/config/catalyst-loader.js';
import type { RiotPlanConfig } from '../../src/config/schema.js';

describe('catalyst-loader', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `riotplan-catalyst-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Save original environment
    originalEnv = { ...process.env };

    // Clear cache before each test
    clearCatalystCache();
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });

    // Restore original environment
    process.env = originalEnv;

    // Clear cache after each test
    clearCatalystCache();
  });

  describe('loadConfiguredCatalysts', () => {
    it('should return null when config is null', async () => {
      const result = await loadConfiguredCatalysts(null);
      expect(result).toBeNull();
    });

    it('should return null when config has no catalysts', async () => {
      const config: RiotPlanConfig = {
        planDirectory: './plans',
      };
      const result = await loadConfiguredCatalysts(config);
      expect(result).toBeNull();
    });

    it('should return null when catalysts array is empty', async () => {
      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [],
      };
      const result = await loadConfiguredCatalysts(config);
      expect(result).toBeNull();
    });

    it('should load a single valid catalyst', async () => {
      // Create a test catalyst
      const catalystDir = join(testDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/catalyst'
name: Test Catalyst
version: 1.0.0
description: A test catalyst
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'basic.md'),
        '# Test Questions\n\nWhat is your goal?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [catalystDir],
      };

      const result = await loadConfiguredCatalysts(config, testDir);
      expect(result).not.toBeNull();
      expect(result?.catalystIds).toHaveLength(1);
      expect(result?.catalystIds[0]).toBe('@test/catalyst');
    });

    it('should load multiple catalysts in order', async () => {
      // Create two test catalysts
      const catalyst1Dir = join(testDir, 'catalyst-1');
      const catalyst2Dir = join(testDir, 'catalyst-2');

      await mkdir(join(catalyst1Dir, 'questions'), { recursive: true });
      await mkdir(join(catalyst2Dir, 'questions'), { recursive: true });

      await writeFile(
        join(catalyst1Dir, 'catalyst.yml'),
        `id: '@test/catalyst-1'
name: First Catalyst
version: 1.0.0
description: First test catalyst
facets:
  questions: true
`
      );

      await writeFile(
        join(catalyst1Dir, 'questions', 'q1.md'),
        '# Questions 1\n\nFirst question?'
      );

      await writeFile(
        join(catalyst2Dir, 'catalyst.yml'),
        `id: '@test/catalyst-2'
name: Second Catalyst
version: 1.0.0
description: Second test catalyst
facets:
  questions: true
`
      );

      await writeFile(
        join(catalyst2Dir, 'questions', 'q2.md'),
        '# Questions 2\n\nSecond question?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [catalyst1Dir, catalyst2Dir],
      };

      const result = await loadConfiguredCatalysts(config, testDir);
      expect(result).not.toBeNull();
      expect(result?.catalystIds).toHaveLength(2);
      expect(result?.catalystIds[0]).toBe('@test/catalyst-1');
      expect(result?.catalystIds[1]).toBe('@test/catalyst-2');
    });

    it('should resolve relative paths from config directory', async () => {
      // Create a test catalyst in a subdirectory
      const catalystDir = join(testDir, 'catalysts', 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/relative'
name: Relative Catalyst
version: 1.0.0
description: A catalyst loaded via relative path
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q.md'),
        '# Question\n\nWhat?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: ['catalysts/test-catalyst'],
      };

      const result = await loadConfiguredCatalysts(config, testDir);
      expect(result).not.toBeNull();
      expect(result?.catalystIds[0]).toBe('@test/relative');
    });

    it('should use catalystDirectory when specified', async () => {
      // Create a catalyst directory structure
      const catalystBaseDir = join(testDir, 'my-catalysts');
      const catalystDir = join(catalystBaseDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/from-dir'
name: From Directory
version: 1.0.0
description: Loaded from catalystDirectory
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q.md'),
        '# Question\n\nWhat?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalystDirectory: catalystBaseDir,
        catalysts: ['test-catalyst'],
      };

      const result = await loadConfiguredCatalysts(config, testDir);
      expect(result).not.toBeNull();
      expect(result?.catalystIds[0]).toBe('@test/from-dir');
    });

    it('should throw error for non-existent catalyst', async () => {
      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: ['non-existent-catalyst'],
      };

      await expect(
        loadConfiguredCatalysts(config, testDir)
      ).rejects.toThrow(/Catalyst not found/);
    });

    it('should throw error for invalid catalyst manifest', async () => {
      // Create a catalyst with invalid manifest
      const catalystDir = join(testDir, 'invalid-catalyst');
      await mkdir(catalystDir, { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        'invalid: yaml: content: ['
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [catalystDir],
      };

      await expect(
        loadConfiguredCatalysts(config, testDir)
      ).rejects.toThrow(/Failed to load catalyst/);
    });

    it('should cache loaded catalysts', async () => {
      // Create a test catalyst
      const catalystDir = join(testDir, 'cached-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/cached'
name: Cached Catalyst
version: 1.0.0
description: Should be cached
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q.md'),
        '# Question\n\nWhat?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [catalystDir],
      };

      // Load twice
      const result1 = await loadConfiguredCatalysts(config, testDir);
      const result2 = await loadConfiguredCatalysts(config, testDir);

      // Should be the same object (cached)
      expect(result1).toBe(result2);
    });

    it('should reload when cache is cleared', async () => {
      // Create a test catalyst
      const catalystDir = join(testDir, 'reload-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/reload'
name: Reload Catalyst
version: 1.0.0
description: Should reload after cache clear
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q.md'),
        '# Question\n\nWhat?'
      );

      const config: RiotPlanConfig = {
        planDirectory: './plans',
        catalysts: [catalystDir],
      };

      // Load, clear cache, load again
      const result1 = await loadConfiguredCatalysts(config, testDir);
      clearCatalystCache();
      const result2 = await loadConfiguredCatalysts(config, testDir);

      // Should be different objects (reloaded)
      expect(result1).not.toBe(result2);
      // But should have the same content
      expect(result1?.catalystIds[0]).toBe(result2?.catalystIds[0]);
    });
  });

  describe('getCatalystEnvOverrides', () => {
    it('should return null when no environment variables are set', () => {
      delete process.env.RIOTPLAN_CATALYSTS;
      delete process.env.RIOTPLAN_CATALYST_DIRECTORY;

      const result = getCatalystEnvOverrides();
      expect(result).toBeNull();
    });

    it('should parse RIOTPLAN_CATALYSTS as comma-separated list', () => {
      process.env.RIOTPLAN_CATALYSTS = 'catalyst1,catalyst2,catalyst3';

      const result = getCatalystEnvOverrides();
      expect(result).not.toBeNull();
      expect(result?.catalysts).toEqual(['catalyst1', 'catalyst2', 'catalyst3']);
    });

    it('should trim whitespace from catalyst identifiers', () => {
      process.env.RIOTPLAN_CATALYSTS = ' catalyst1 , catalyst2 , catalyst3 ';

      const result = getCatalystEnvOverrides();
      expect(result?.catalysts).toEqual(['catalyst1', 'catalyst2', 'catalyst3']);
    });

    it('should filter out empty strings', () => {
      process.env.RIOTPLAN_CATALYSTS = 'catalyst1,,catalyst2,';

      const result = getCatalystEnvOverrides();
      expect(result?.catalysts).toEqual(['catalyst1', 'catalyst2']);
    });

    it('should read RIOTPLAN_CATALYST_DIRECTORY', () => {
      process.env.RIOTPLAN_CATALYST_DIRECTORY = '/path/to/catalysts';

      const result = getCatalystEnvOverrides();
      expect(result).not.toBeNull();
      expect(result?.catalystDirectory).toBe('/path/to/catalysts');
    });

    it('should combine both environment variables', () => {
      process.env.RIOTPLAN_CATALYSTS = 'catalyst1,catalyst2';
      process.env.RIOTPLAN_CATALYST_DIRECTORY = '/path/to/catalysts';

      const result = getCatalystEnvOverrides();
      expect(result).not.toBeNull();
      expect(result?.catalysts).toEqual(['catalyst1', 'catalyst2']);
      expect(result?.catalystDirectory).toBe('/path/to/catalysts');
    });
  });
});
