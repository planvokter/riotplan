/**
 * Tests for catalyst MCP tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import {
  catalystTool,
} from '../../../src/mcp/tools/catalyst.js';
import type { ToolExecutionContext } from '../../../src/mcp/types.js';

// Helper wrappers to call tool.execute
const executeCatalystList = (args: any, context: ToolExecutionContext) => 
  catalystTool.execute({ ...args, action: 'list' }, context);
const executeCatalystShow = (args: any, context: ToolExecutionContext) => 
  catalystTool.execute({ ...args, action: 'show' }, context);
const executeCatalystAssociate = (args: any, context: ToolExecutionContext) => 
  catalystTool.execute({ ...args, action: 'associate' }, context);

describe('catalyst tools', () => {
  let testDir: string;
  let mockContext: ToolExecutionContext;

  beforeEach(async () => {
    testDir = join(tmpdir(), `riotplan-catalyst-tools-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    mockContext = {
      workingDirectory: testDir,
      session: null,
      mcpServer: null as any,
      sendNotification: async () => {},
    };
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('executeCatalystList', () => {
    it('should return empty list when no catalysts configured', async () => {
      const result = await executeCatalystList({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.catalysts).toEqual([]);
      expect(result.message).toContain('No catalysts configured');
    });

    // Note: Full integration test would require setting up config and catalysts
    // which is complex for unit tests. This test verifies the basic flow.
  });

  describe('executeCatalystShow', () => {
    it('should return error for non-existent catalyst', async () => {
      const result = await executeCatalystShow(
        { catalyst: '/non/existent/path' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load catalyst');
    });

    it('should show catalyst details for valid catalyst', async () => {
      // Create a test catalyst
      const catalystDir = join(testDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/show-catalyst'
name: Show Test Catalyst
version: 1.0.0
description: A catalyst for testing show
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q1.md'),
        '# Question 1\n\nWhat is your goal?'
      );

      const result = await executeCatalystShow(
        { catalyst: catalystDir },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.manifest.id).toBe('@test/show-catalyst');
      expect(result.data?.manifest.name).toBe('Show Test Catalyst');
      expect(result.data?.facets.questions).toBeDefined();
      expect(result.data?.facets.questions.fileCount).toBe(1);
    });
  });

  describe('executeCatalystAssociate', () => {
    async function createSqlitePlan(planId: string): Promise<string> {
      const sqlitePath = join(testDir, `${planId}.plan`);
      const now = new Date().toISOString();
      const provider = createSqliteProvider(sqlitePath);
      await provider.initialize({
        id: planId,
        uuid: '00000000-0000-4000-8000-000000000401',
        name: planId,
        stage: 'idea',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await provider.close();
      return sqlitePath;
    }

    it('should return error when no catalysts specified', async () => {
      const planPath = await createSqlitePlan('assoc-empty');
      const result = await executeCatalystAssociate(
        { planId: planPath, catalysts: [], operation: 'add' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No catalysts specified');
    });

    it('should return error when catalyst cannot be loaded', async () => {
      const result = await executeCatalystAssociate(
        { catalysts: ['/non/existent'], operation: 'add', planId: await createSqlitePlan('assoc-missing-cat') },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be loaded');
    });

    it('should return sqlite binding error when using sqlite plans', async () => {
      // Create a valid catalyst
      const catalystDir = join(testDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/associate-catalyst'
name: Associate Test
version: 1.0.0
description: Test
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q1.md'),
        '# Q1'
      );

      const planPath = await createSqlitePlan('assoc-plan');

      const result = await executeCatalystAssociate(
        {
          planId: planPath,
          catalysts: [catalystDir],
          operation: 'add',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(String(result.error).toLowerCase()).toContain('not a directory');
    });

    it('should reject add operation for sqlite plans', async () => {
      // Create a valid catalyst
      const catalystDir = join(testDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/add-catalyst'
name: Add Test
version: 1.0.0
description: Test
facets:
  questions: true
`
      );

      await writeFile(
        join(catalystDir, 'questions', 'q1.md'),
        '# Q1'
      );

      const planPath = await createSqlitePlan('assoc-add');

      const result = await executeCatalystAssociate(
        {
          planId: planPath,
          catalysts: [catalystDir],
          operation: 'add',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(String(result.error).toLowerCase()).toContain('not a directory');
    });

    it('should reject set operation for sqlite plans', async () => {
      // Create two valid catalysts
      const catalyst1Dir = join(testDir, 'catalyst-1');
      const catalyst2Dir = join(testDir, 'catalyst-2');

      for (const dir of [catalyst1Dir, catalyst2Dir]) {
        await mkdir(dir, { recursive: true });
        await mkdir(join(dir, 'questions'), { recursive: true });

        const id = dir === catalyst1Dir ? '@test/cat1' : '@test/cat2';
        await writeFile(
          join(dir, 'catalyst.yml'),
          `id: '${id}'
name: Test
version: 1.0.0
description: Test
facets:
  questions: true
`
        );

        await writeFile(join(dir, 'questions', 'q1.md'), '# Q1');
      }

      const planPath = await createSqlitePlan('assoc-set');

      // Set to catalyst2 (replacing catalyst1)
      const result = await executeCatalystAssociate(
        {
          planId: planPath,
          catalysts: [catalyst2Dir],
          operation: 'set',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(String(result.error).toLowerCase()).toContain('not a directory');
    });

    it('should reject remove operation for sqlite plans', async () => {
      // Create a valid catalyst
      const catalystDir = join(testDir, 'test-catalyst');
      await mkdir(catalystDir, { recursive: true });
      await mkdir(join(catalystDir, 'questions'), { recursive: true });

      await writeFile(
        join(catalystDir, 'catalyst.yml'),
        `id: '@test/remove-catalyst'
name: Remove Test
version: 1.0.0
description: Test
facets:
  questions: true
`
      );

      await writeFile(join(catalystDir, 'questions', 'q1.md'), '# Q1');

      const planPath = await createSqlitePlan('assoc-remove');

      // Remove the catalyst
      const result = await executeCatalystAssociate(
        {
          planId: planPath,
          catalysts: [catalystDir],
          operation: 'remove',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(String(result.error).toLowerCase()).toContain('not a directory');
    });
  });
});
