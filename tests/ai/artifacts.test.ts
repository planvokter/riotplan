/**
 * Tests for artifact loading utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractConstraints,
  extractQuestions,
  extractSelectedApproach,
  loadCatalystContent,
} from '../../src/ai/artifacts.js';

describe('artifacts', () => {
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
});
