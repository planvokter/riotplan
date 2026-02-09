/**
 * End-to-end integration test for catalyst system
 * 
 * This test verifies the complete catalyst pipeline:
 * 1. Loading catalysts from configuration
 * 2. Merging multiple catalysts
 * 3. Injecting catalyst content into plan generation
 * 4. Recording catalyst traceability in plan output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfiguredCatalysts } from '../../src/config/catalyst-loader.js';
import { loadCatalystContent } from '../../src/ai/artifacts.js';
import type { RiotPlanConfig } from '../../src/config/schema.js';

describe('Catalyst End-to-End Integration', () => {
  let testDir: string;
  let catalystDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `riotplan-e2e-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create a complete test catalyst
    catalystDir = join(testDir, 'test-catalyst');
    await mkdir(join(catalystDir, 'questions'), { recursive: true });
    await mkdir(join(catalystDir, 'constraints'), { recursive: true });
    await mkdir(join(catalystDir, 'domain-knowledge'), { recursive: true });
    await mkdir(join(catalystDir, 'process-guidance'), { recursive: true });

    // Write catalyst manifest
    await writeFile(
      join(catalystDir, 'catalyst.yml'),
      `id: '@test/e2e-catalyst'
name: E2E Test Catalyst
version: 1.0.0
description: A complete catalyst for end-to-end testing
facets:
  questions: true
  constraints: true
  domainKnowledge: true
  processGuidance: true
`
    );

    // Write facet files
    await writeFile(
      join(catalystDir, 'questions', 'setup.md'),
      '# Setup Questions\n\n1. What version will you target?\n2. What dependencies do you need?'
    );

    await writeFile(
      join(catalystDir, 'constraints', 'testing.md'),
      '# Testing Constraint\n\nAll projects must have 80% test coverage.'
    );

    await writeFile(
      join(catalystDir, 'domain-knowledge', 'architecture.md'),
      '# Architecture\n\nThis project uses a modular architecture with clear separation of concerns.'
    );

    await writeFile(
      join(catalystDir, 'process-guidance', 'workflow.md'),
      '# Workflow\n\nFollow test-driven development practices.'
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load catalyst from configuration', async () => {
    const config: RiotPlanConfig = {
      planDirectory: './plans',
      catalysts: [catalystDir],
    };

    const merged = await loadConfiguredCatalysts(config, testDir);

    expect(merged).not.toBeNull();
    expect(merged?.catalystIds).toEqual(['@test/e2e-catalyst']);
    
    // Check that facets exist and have content
    expect(merged?.facets.questions).toBeDefined();
    expect(merged?.facets.questions?.length).toBeGreaterThan(0);
    expect(merged?.facets.constraints).toBeDefined();
    expect(merged?.facets.constraints?.length).toBeGreaterThan(0);
    expect(merged?.facets.domainKnowledge).toBeDefined();
    expect(merged?.facets.domainKnowledge?.length).toBeGreaterThan(0);
    expect(merged?.facets.processGuidance).toBeDefined();
    expect(merged?.facets.processGuidance?.length).toBeGreaterThan(0);
  });

  it('should convert merged catalyst to generation context format', async () => {
    const config: RiotPlanConfig = {
      planDirectory: './plans',
      catalysts: [catalystDir],
    };

    const merged = await loadConfiguredCatalysts(config, testDir);
    const catalystContent = loadCatalystContent(merged);

    expect(catalystContent).toBeDefined();
    expect(catalystContent?.appliedCatalysts).toEqual(['@test/e2e-catalyst']);
    expect(catalystContent?.questions).toContain('Setup Questions');
    expect(catalystContent?.questions).toContain('What version will you target?');
    expect(catalystContent?.constraints).toContain('Testing Constraint');
    expect(catalystContent?.constraints).toContain('80% test coverage');
    expect(catalystContent?.domainKnowledge).toContain('Architecture');
    expect(catalystContent?.processGuidance).toContain('Workflow');
  });

  it('should merge multiple catalysts in order', async () => {
    // Create a second catalyst
    const catalyst2Dir = join(testDir, 'catalyst-2');
    await mkdir(join(catalyst2Dir, 'constraints'), { recursive: true });

    await writeFile(
      join(catalyst2Dir, 'catalyst.yml'),
      `id: '@test/second-catalyst'
name: Second Catalyst
version: 1.0.0
description: Additional constraints
facets:
  constraints: true
`
    );

    await writeFile(
      join(catalyst2Dir, 'constraints', 'docs.md'),
      '# Documentation\n\nAll projects must have comprehensive documentation.'
    );

    const config: RiotPlanConfig = {
      planDirectory: './plans',
      catalysts: [catalystDir, catalyst2Dir],
    };

    const merged = await loadConfiguredCatalysts(config, testDir);
    const catalystContent = loadCatalystContent(merged);

    expect(catalystContent?.appliedCatalysts).toEqual([
      '@test/e2e-catalyst',
      '@test/second-catalyst',
    ]);
    expect(catalystContent?.constraints).toContain('Testing Constraint');
    expect(catalystContent?.constraints).toContain('Documentation');
    expect(catalystContent?.constraints).toContain('From @test/e2e-catalyst');
    expect(catalystContent?.constraints).toContain('From @test/second-catalyst');
  });

  it('should handle catalysts with only some facets', async () => {
    // Create a minimal catalyst with only constraints
    const minimalDir = join(testDir, 'minimal-catalyst');
    await mkdir(join(minimalDir, 'constraints'), { recursive: true });

    await writeFile(
      join(minimalDir, 'catalyst.yml'),
      `id: '@test/minimal'
name: Minimal Catalyst
version: 1.0.0
description: Only constraints
facets:
  constraints: true
`
    );

    await writeFile(
      join(minimalDir, 'constraints', 'rule.md'),
      '# Rule\n\nMust follow this rule.'
    );

    const config: RiotPlanConfig = {
      planDirectory: './plans',
      catalysts: [minimalDir],
    };

    const merged = await loadConfiguredCatalysts(config, testDir);
    const catalystContent = loadCatalystContent(merged);

    expect(catalystContent?.appliedCatalysts).toEqual(['@test/minimal']);
    expect(catalystContent?.constraints).toContain('Must follow this rule');
    expect(catalystContent?.questions).toBe('');
    expect(catalystContent?.domainKnowledge).toBe('');
  });
});
