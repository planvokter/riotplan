/**
 * Tests for artifact loading utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import {
  extractConstraints,
  extractQuestions,
  extractSelectedApproach,
  loadCatalystContent,
  loadArtifacts,
} from '../../src/ai/artifacts.js';

describe('artifacts', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `riotplan-artifacts-test-${Date.now()}`);
    await mkdir(testRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  describe('extractConstraints', () => {
    it('should extract constraints from IDEA.md content', () => {
      const ideaContent = `# Idea

## Core Concept

Some concept here.

## Constraints

- Must be backward compatible
- Must support TypeScript
- Must have 80% test coverage

## Notes

Some notes.
`;
      const constraints = extractConstraints(ideaContent);
      expect(constraints).toEqual([
        'Must be backward compatible',
        'Must support TypeScript',
        'Must have 80% test coverage',
      ]);
    });

    it('should return empty array when no constraints section', () => {
      const ideaContent = `# Idea

## Core Concept

Some concept here.
`;
      const constraints = extractConstraints(ideaContent);
      expect(constraints).toEqual([]);
    });

    it('should skip placeholder text', () => {
      const ideaContent = `# Idea

## Constraints

- _Add constraints here_
- Real constraint

## Notes
`;
      const constraints = extractConstraints(ideaContent);
      expect(constraints).toEqual(['Real constraint']);
    });
  });

  describe('extractQuestions', () => {
    it('should extract questions from IDEA.md content', () => {
      const ideaContent = `# Idea

## Questions

- How should we handle errors?
- What is the expected performance?

## Notes
`;
      const questions = extractQuestions(ideaContent);
      expect(questions).toEqual([
        'How should we handle errors?',
        'What is the expected performance?',
      ]);
    });

    it('should return empty array when no questions section', () => {
      const ideaContent = `# Idea

## Core Concept

Some concept.
`;
      const questions = extractQuestions(ideaContent);
      expect(questions).toEqual([]);
    });
  });

  describe('extractSelectedApproach', () => {
    it('should extract selected approach from SHAPING.md', () => {
      const shapingContent = `# Shaping

**Selected Approach**: Foundation First

**Reasoning**: This approach allows iteration before publishing.

### Approach: Foundation First

**Description**: Build the core engine first, then integrate.

**Tradeoffs**:
- Pro: Can iterate on schema
- Con: Takes longer
`;
      const approach = extractSelectedApproach(shapingContent);
      expect(approach).not.toBeNull();
      expect(approach?.name).toBe('Foundation First');
      expect(approach?.description).toContain('Build the core engine first');
      expect(approach?.reasoning).toBe('This approach allows iteration before publishing.');
    });

    it('should return null when no selected approach', () => {
      const shapingContent = `# Shaping

## Approaches

### Approach: Option A

Some description.
`;
      const approach = extractSelectedApproach(shapingContent);
      expect(approach).toBeNull();
    });
  });

  describe('loadCatalystContent', () => {
    it('should return undefined when mergedCatalyst is null', () => {
      const result = loadCatalystContent(null);
      expect(result).toBeUndefined();
    });

    it('should convert merged catalyst to generation context format', () => {
      const mergedCatalyst = {
        catalystIds: ['@test/catalyst-1', '@test/catalyst-2'],
        facets: {
          constraints: [
            { content: 'Must have tests', sourceId: '@test/catalyst-1' },
            { content: 'Must have docs', sourceId: '@test/catalyst-2' },
          ],
          questions: [
            { content: 'What version?', sourceId: '@test/catalyst-1' },
          ],
          domainKnowledge: [],
          outputTemplates: undefined,
          processGuidance: undefined,
          validationRules: undefined,
        },
      };

      const result = loadCatalystContent(mergedCatalyst);

      expect(result).not.toBeUndefined();
      expect(result?.appliedCatalysts).toEqual(['@test/catalyst-1', '@test/catalyst-2']);
      expect(result?.constraints).toContain('Must have tests');
      expect(result?.constraints).toContain('Must have docs');
      expect(result?.constraints).toContain('From @test/catalyst-1');
      expect(result?.constraints).toContain('From @test/catalyst-2');
      expect(result?.questions).toContain('What version?');
      expect(result?.domainKnowledge).toBe('');
      expect(result?.outputTemplates).toBe('');
    });

    it('should group content by source catalyst', () => {
      const mergedCatalyst = {
        catalystIds: ['@test/catalyst-1'],
        facets: {
          constraints: [
            { content: 'Constraint A', sourceId: '@test/catalyst-1' },
            { content: 'Constraint B', sourceId: '@test/catalyst-1' },
          ],
        },
      };

      const result = loadCatalystContent(mergedCatalyst);

      expect(result?.constraints).toContain('### From @test/catalyst-1');
      expect(result?.constraints).toContain('Constraint A');
      expect(result?.constraints).toContain('Constraint B');
      // Should only have one header for the same source
      const headerCount = (result?.constraints.match(/### From @test\/catalyst-1/g) || []).length;
      expect(headerCount).toBe(1);
    });

    it('should handle empty facets', () => {
      const mergedCatalyst = {
        catalystIds: ['@test/empty'],
        facets: {},
      };

      const result = loadCatalystContent(mergedCatalyst);

      expect(result).not.toBeUndefined();
      expect(result?.constraints).toBe('');
      expect(result?.questions).toBe('');
      expect(result?.domainKnowledge).toBe('');
      expect(result?.outputTemplates).toBe('');
      expect(result?.processGuidance).toBe('');
      expect(result?.validationRules).toBe('');
      expect(result?.appliedCatalysts).toEqual(['@test/empty']);
    });

    it('should handle all facet types', () => {
      const mergedCatalyst = {
        catalystIds: ['@test/full'],
        facets: {
          constraints: [{ content: 'C1', sourceId: '@test/full' }],
          questions: [{ content: 'Q1', sourceId: '@test/full' }],
          domainKnowledge: [{ content: 'DK1', sourceId: '@test/full' }],
          outputTemplates: [{ content: 'OT1', sourceId: '@test/full' }],
          processGuidance: [{ content: 'PG1', sourceId: '@test/full' }],
          validationRules: [{ content: 'VR1', sourceId: '@test/full' }],
        },
      };

      const result = loadCatalystContent(mergedCatalyst);

      expect(result?.constraints).toContain('C1');
      expect(result?.questions).toContain('Q1');
      expect(result?.domainKnowledge).toContain('DK1');
      expect(result?.outputTemplates).toContain('OT1');
      expect(result?.processGuidance).toContain('PG1');
      expect(result?.validationRules).toContain('VR1');
    });
  });

  describe('loadArtifacts', () => {
    it('loads artifacts from directory plans', async () => {
      const planPath = join(testRoot, 'directory-plan');
      await mkdir(join(planPath, 'evidence'), { recursive: true });
      await mkdir(join(planPath, '.history'), { recursive: true });
      await writeFile(
        join(planPath, 'IDEA.md'),
        `# Idea

## Core Concept

Directory context

## Constraints

- Constraint A

## Questions

- Question A
`,
        'utf-8'
      );
      await writeFile(
        join(planPath, 'SHAPING.md'),
        `# Shaping

**Selected Approach**: Dir approach
**Reasoning**: Works with files.

### Approach: Dir approach
**Description**: Use markdown files.
`,
        'utf-8'
      );
      await writeFile(join(planPath, 'LIFECYCLE.md'), '# Lifecycle', 'utf-8');
      await writeFile(join(planPath, 'evidence', 'one.md'), 'evidence body', 'utf-8');
      await writeFile(
        join(planPath, '.history', 'timeline.jsonl'),
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'evidence_added',
          data: { description: 'Directory evidence' },
        })}\n`,
        'utf-8'
      );

      const artifacts = await loadArtifacts(planPath);
      expect(artifacts.ideaContent).toContain('Directory context');
      expect(artifacts.shapingContent).toContain('Dir approach');
      expect(artifacts.constraints).toEqual(['Constraint A']);
      expect(artifacts.questions).toEqual(['Question A']);
      expect(artifacts.evidence).toHaveLength(1);
      expect(artifacts.historyContext.totalEvents).toBe(1);
    });

    it('loads artifacts from SQLite plans', async () => {
      const sqlitePath = join(testRoot, 'sqlite.plan');
      const now = new Date().toISOString();
      const provider = createSqliteProvider(sqlitePath);
      await provider.initialize({
        id: 'sqlite-plan',
        uuid: '00000000-0000-4000-8000-000000000011',
        name: 'SQLite Plan',
        stage: 'shaping',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await provider.saveFile({
        type: 'idea',
        filename: 'IDEA.md',
        content: `# Idea

## Core Concept

SQLite context

## Constraints

- SQLite constraint

## Questions

- SQLite question
`,
        createdAt: now,
        updatedAt: now,
      });
      await provider.saveFile({
        type: 'shaping',
        filename: 'SHAPING.md',
        content: `# Shaping

**Selected Approach**: DB approach
**Reasoning**: Keep data in SQLite.

### Approach: DB approach
**Description**: Use provider API.
`,
        createdAt: now,
        updatedAt: now,
      });
      await provider.addEvidence({
        id: 'ev-sqlite',
        description: 'SQLite evidence',
        content: 'SQLite evidence content',
        createdAt: now,
      });
      await provider.addTimelineEvent({
        id: 'evt-sqlite',
        timestamp: now,
        type: 'evidence_added',
        data: { description: 'SQLite evidence' },
      });
      await provider.close();

      const artifacts = await loadArtifacts(sqlitePath);
      expect(artifacts.ideaContent).toContain('SQLite context');
      expect(artifacts.shapingContent).toContain('DB approach');
      expect(artifacts.constraints).toEqual(['SQLite constraint']);
      expect(artifacts.questions).toEqual(['SQLite question']);
      expect(artifacts.evidence).toHaveLength(1);
      expect(artifacts.evidence[0].name).toBe('ev-sqlite.md');
      expect(artifacts.historyContext.totalEvents).toBe(1);
      expect(artifacts.lifecycleContent).toContain('Stage');
    });

    it('loads SQLite idea content by filename even when type differs', async () => {
      const sqlitePath = join(testRoot, 'sqlite-filename.plan');
      const now = new Date().toISOString();
      const provider = createSqliteProvider(sqlitePath);
      await provider.initialize({
        id: 'sqlite-filename-plan',
        uuid: '00000000-0000-4000-8000-000000000012',
        name: 'SQLite Filename Plan',
        stage: 'idea',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await provider.saveFile({
        type: 'prompt',
        filename: 'IDEA.md',
        content: `# Idea

## Problem

The idea should still be found even if stored under another artifact type.
`,
        createdAt: now,
        updatedAt: now,
      });
      await provider.close();

      const artifacts = await loadArtifacts(sqlitePath);
      expect(artifacts.ideaContent).toContain('stored under another artifact type');
      expect(artifacts.artifactDiagnostics?.hasIdeaArtifact).toBe(true);
      expect(artifacts.artifactDiagnostics?.detectedArtifacts).toEqual([
        { type: 'prompt', filename: 'IDEA.md' },
      ]);
    });
  });
});
