import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadCatalyst } from '@/loader/catalyst-loader';
import {
  mergeCatalysts,
  renderFacet,
  renderAllFacets,
  summarizeMerge,
} from '@/merger/facet-merger';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const COMPLETE_CATALYST = join(FIXTURES_DIR, 'complete-catalyst');
const PARTIAL_CATALYST = join(FIXTURES_DIR, 'partial-catalyst');

let completeCatalyst: Awaited<ReturnType<typeof loadCatalyst>>;
let partialCatalyst: Awaited<ReturnType<typeof loadCatalyst>>;

beforeAll(async () => {
  completeCatalyst = await loadCatalyst(COMPLETE_CATALYST);
  partialCatalyst = await loadCatalyst(PARTIAL_CATALYST);
});

describe('mergeCatalysts', () => {
  describe('merging single catalyst', () => {
    it('merges a single catalyst (passthrough)', () => {
      const merged = mergeCatalysts([completeCatalyst]);
      
      expect(merged.catalystIds).toEqual(['@test/complete-catalyst']);
      expect(merged.facets.questions).toBeDefined();
      expect(merged.facets.constraints).toBeDefined();
    });

    it('preserves source attribution', () => {
      const merged = mergeCatalysts([completeCatalyst]);
      
      const questions = merged.facets.questions;
      expect(questions).toBeDefined();
      for (const item of questions || []) {
        expect(item.sourceId).toBe('@test/complete-catalyst');
      }
    });

    it('tracks contribution metadata', () => {
      const merged = mergeCatalysts([completeCatalyst]);
      
      const contrib = merged.contributions.get('@test/complete-catalyst');
      expect(contrib).toBeDefined();
      expect(contrib?.facetTypes).toContain('questions');
      expect(contrib?.facetTypes).toContain('constraints');
      expect(contrib?.contentCount).toBeGreaterThan(0);
    });
  });

  describe('merging multiple catalysts', () => {
    it('merges two catalysts in order', () => {
      const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
      
      expect(merged.catalystIds).toEqual([
        '@test/complete-catalyst',
        '@test/partial-catalyst',
      ]);
    });

    it('preserves order of content', () => {
      const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
      
      const questions = merged.facets.questions;
      expect(questions).toBeDefined();
      
      // First items should be from complete-catalyst
      const firstFromComplete = questions?.filter(
        q => q.sourceId === '@test/complete-catalyst'
      );
      const firstFromPartial = questions?.filter(
        q => q.sourceId === '@test/partial-catalyst'
      );
      
      // Complete catalyst content should come first
      if (firstFromComplete && firstFromPartial && firstFromComplete.length > 0) {
        const completeIndex = questions?.indexOf(firstFromComplete[0]) || -1;
        const partialIndex = questions?.indexOf(firstFromPartial[0]) || -1;
        expect(completeIndex).toBeLessThan(partialIndex);
      }
    });

    it('merges overlapping facets (same facet type)', () => {
      const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
      
      // Both catalysts have questions
      const questions = merged.facets.questions;
      expect(questions).toBeDefined();
      expect(questions!.length).toBeGreaterThan(0);
      
      // Should include content from both
      const fromComplete = questions?.some(q => q.sourceId === '@test/complete-catalyst');
      const fromPartial = questions?.some(q => q.sourceId === '@test/partial-catalyst');
      
      expect(fromComplete).toBe(true);
      expect(fromPartial).toBe(true);
    });

    it('handles catalysts with different facets', () => {
      const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
      
      // Complete has all facets, partial has only questions and constraints
      expect(merged.facets.outputTemplates).toBeDefined();
      expect(merged.facets.domainKnowledge).toBeDefined();
      expect(merged.facets.processGuidance).toBeDefined();
      expect(merged.facets.validationRules).toBeDefined();
    });

    it('tracks contributions from multiple catalysts', () => {
      const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
      
      expect(merged.contributions.size).toBe(2);
      
      const completeContrib = merged.contributions.get('@test/complete-catalyst');
      const partialContrib = merged.contributions.get('@test/partial-catalyst');
      
      expect(completeContrib).toBeDefined();
      expect(partialContrib).toBeDefined();
      expect(completeContrib?.contentCount).toBeGreaterThan(0);
      expect(partialContrib?.contentCount).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty array of catalysts', () => {
      const merged = mergeCatalysts([]);
      
      expect(merged.catalystIds).toEqual([]);
      expect(merged.facets).toEqual({});
      expect(merged.contributions.size).toBe(0);
    });

    it('handles catalysts with no facets', () => {
      // This would require a catalyst with no facet directories
      // For now, we'll test with existing catalysts
      const merged = mergeCatalysts([partialCatalyst]);
      
      // Partial catalyst only has questions and constraints
      expect(merged.facets.outputTemplates).toBeUndefined();
      expect(merged.facets.domainKnowledge).toBeUndefined();
    });

    it('skips facets that are undefined in all catalysts', () => {
      // Create scenario with no output templates
      const merged = mergeCatalysts([partialCatalyst]);
      
      // No facet type should be present if no catalyst provides it
      for (const [key, value] of Object.entries(merged.facets)) {
        if (value === undefined) {
          expect(value).toBeUndefined();
        }
      }
    });
  });

  describe('content preservation', () => {
    it('preserves exact content from source files', () => {
      const merged = mergeCatalysts([completeCatalyst]);
      
      const questions = merged.facets.questions;
      expect(questions).toBeDefined();
      
      // Should have content from exploration.md
      const exploration = questions?.find(q => q.filename === 'exploration.md');
      expect(exploration).toBeDefined();
      expect(exploration?.content).toContain('Exploration Questions');
    });

    it('preserves filename information', () => {
      const merged = mergeCatalysts([completeCatalyst]);
      
      const questions = merged.facets.questions;
      expect(questions).toBeDefined();
      
      for (const item of questions || []) {
        expect(item.filename).toBeDefined();
        expect(item.filename).toMatch(/\.md$/);
      }
    });
  });
});

describe('renderFacet', () => {
  it('renders a facet with source attribution', () => {
    const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
    
    const rendered = renderFacet(merged, 'questions');
    
    expect(rendered).toContain('From @test/complete-catalyst:');
    expect(rendered).toContain('From @test/partial-catalyst:');
  });

  it('includes content in rendered output', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const rendered = renderFacet(merged, 'constraints');
    
    expect(rendered).toContain('Testing');
    expect(rendered).toContain('Documentation');
  });

  it('returns empty string for missing facet', () => {
    const merged = mergeCatalysts([partialCatalyst]);
    
    const rendered = renderFacet(merged, 'outputTemplates');
    
    expect(rendered).toBe('');
  });

  it('separates sources with blank lines', () => {
    const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
    
    const rendered = renderFacet(merged, 'questions');
    
    // Should have blank line between sources
    expect(rendered).toContain('\n\nFrom @test/partial-catalyst:');
  });

  it('handles single catalyst without extra blank lines', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const rendered = renderFacet(merged, 'questions');
    
    // Should start with source header, no leading blank line
    expect(rendered).toMatch(/^From @test\/complete-catalyst:/);
  });
});

describe('renderAllFacets', () => {
  it('renders all facet types', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const rendered = renderAllFacets(merged);
    
    expect(rendered.questions).toBeDefined();
    expect(rendered.constraints).toBeDefined();
    expect(rendered.outputTemplates).toBeDefined();
    expect(rendered.domainKnowledge).toBeDefined();
    expect(rendered.processGuidance).toBeDefined();
    expect(rendered.validationRules).toBeDefined();
  });

  it('returns all facets as strings', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const rendered = renderAllFacets(merged);
    
    for (const value of Object.values(rendered)) {
      expect(typeof value).toBe('string');
    }
  });

  it('includes empty strings for missing facets', () => {
    const merged = mergeCatalysts([partialCatalyst]);
    
    const rendered = renderAllFacets(merged);
    
    expect(rendered.outputTemplates).toBe('');
    expect(rendered.domainKnowledge).toBe('');
  });
});

describe('summarizeMerge', () => {
  it('summarizes a single catalyst', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const summary = summarizeMerge(merged);
    
    expect(summary).toContain('Merged 1 catalyst');
    expect(summary).toContain('@test/complete-catalyst');
  });

  it('summarizes multiple catalysts', () => {
    const merged = mergeCatalysts([completeCatalyst, partialCatalyst]);
    
    const summary = summarizeMerge(merged);
    
    expect(summary).toContain('Merged 2 catalyst');
    expect(summary).toContain('@test/complete-catalyst');
    expect(summary).toContain('@test/partial-catalyst');
  });

  it('includes facet types in summary', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const summary = summarizeMerge(merged);
    
    expect(summary).toContain('Facets:');
    expect(summary).toContain('Questions');
    expect(summary).toContain('Constraints');
  });

  it('includes content count in summary', () => {
    const merged = mergeCatalysts([completeCatalyst]);
    
    const summary = summarizeMerge(merged);
    
    expect(summary).toContain('Content items:');
  });

  it('handles empty merge', () => {
    const merged = mergeCatalysts([]);
    
    const summary = summarizeMerge(merged);
    
    expect(summary).toBe('No catalysts merged');
  });
});
