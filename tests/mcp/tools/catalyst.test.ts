/**
 * Tests for catalyst MCP tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
    it('should return error when no catalysts specified', async () => {
      const result = await executeCatalystAssociate(
        { catalysts: [], operation: 'add' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No catalysts specified');
    });

    it('should return error when catalyst cannot be loaded', async () => {
      const result = await executeCatalystAssociate(
        { catalysts: ['/non/existent'], operation: 'add' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be loaded');
    });

    it('should return error when plan.yaml does not exist', async () => {
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

      // Try to associate with a plan that doesn't have plan.yaml
      const planDir = join(testDir, 'test-plan');
      await mkdir(planDir, { recursive: true });

      const result = await executeCatalystAssociate(
        {
          path: planDir,
          catalysts: [catalystDir],
          operation: 'add',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No plan.yaml found');
    });

    it('should add catalyst to existing plan.yaml', async () => {
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

      // Create a plan with plan.yaml
      const planDir = join(testDir, 'test-plan');
      await mkdir(planDir, { recursive: true });

      await writeFile(
        join(planDir, 'plan.yaml'),
        `id: test-plan
title: Test Plan
catalysts: []
`
      );

      const result = await executeCatalystAssociate(
        {
          path: planDir,
          catalysts: [catalystDir],
          operation: 'add',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.catalysts).toContain(catalystDir);
      expect(result.message).toContain('Successfully added catalysts');
    });

    it('should set catalysts replacing existing ones', async () => {
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

      // Create a plan with one catalyst
      const planDir = join(testDir, 'test-plan');
      await mkdir(planDir, { recursive: true });

      await writeFile(
        join(planDir, 'plan.yaml'),
        `id: test-plan
title: Test Plan
catalysts:
  - ${catalyst1Dir}
`
      );

      // Set to catalyst2 (replacing catalyst1)
      const result = await executeCatalystAssociate(
        {
          path: planDir,
          catalysts: [catalyst2Dir],
          operation: 'set',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.catalysts).toEqual([catalyst2Dir]);
      expect(result.data?.catalysts).not.toContain(catalyst1Dir);
    });

    it('should remove catalyst from plan', async () => {
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

      // Create a plan with the catalyst
      const planDir = join(testDir, 'test-plan');
      await mkdir(planDir, { recursive: true });

      await writeFile(
        join(planDir, 'plan.yaml'),
        `id: test-plan
title: Test Plan
catalysts:
  - ${catalystDir}
`
      );

      // Remove the catalyst
      const result = await executeCatalystAssociate(
        {
          path: planDir,
          catalysts: [catalystDir],
          operation: 'remove',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.catalysts).toEqual([]);
    });
  });
});
