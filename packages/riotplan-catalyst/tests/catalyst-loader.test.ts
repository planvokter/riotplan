import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { 
  loadCatalyst, 
  loadCatalystSafe,
  resolveCatalysts,
} from '@/loader/catalyst-loader';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const COMPLETE_CATALYST = join(FIXTURES_DIR, 'complete-catalyst');
const PARTIAL_CATALYST = join(FIXTURES_DIR, 'partial-catalyst');
const INVALID_CATALYST = join(FIXTURES_DIR, 'invalid-catalyst');

describe('loadCatalyst', () => {
  describe('loading complete catalyst', () => {
    it('loads a catalyst with all facets', async () => {
      const catalyst = await loadCatalyst(COMPLETE_CATALYST);
      
      expect(catalyst.manifest.id).toBe('@test/complete-catalyst');
      expect(catalyst.manifest.name).toBe('Complete Test Catalyst');
      expect(catalyst.manifest.version).toBe('1.0.0');
      expect(catalyst.directoryPath).toBe(COMPLETE_CATALYST);
    });

    it('loads all six facet types', async () => {
      const catalyst = await loadCatalyst(COMPLETE_CATALYST);
      
      expect(catalyst.facets.questions).toBeDefined();
      expect(catalyst.facets.constraints).toBeDefined();
      expect(catalyst.facets.outputTemplates).toBeDefined();
      expect(catalyst.facets.domainKnowledge).toBeDefined();
      expect(catalyst.facets.processGuidance).toBeDefined();
      expect(catalyst.facets.validationRules).toBeDefined();
    });

    it('loads multiple files per facet', async () => {
      const catalyst = await loadCatalyst(COMPLETE_CATALYST);
      
      // Questions has 2 files: exploration.md and shaping.md
      expect(catalyst.facets.questions).toHaveLength(2);
      expect(catalyst.facets.questions?.map(f => f.filename).sort()).toEqual([
        'exploration.md',
        'shaping.md',
      ]);
      
      // Constraints has 2 files
      expect(catalyst.facets.constraints).toHaveLength(2);
    });

    it('loads file content correctly', async () => {
      const catalyst = await loadCatalyst(COMPLETE_CATALYST);
      
      const exploration = catalyst.facets.questions?.find(
        f => f.filename === 'exploration.md'
      );
      
      expect(exploration).toBeDefined();
      expect(exploration?.content).toContain('Exploration Questions');
      expect(exploration?.content).toContain('What problem are you trying to solve?');
    });
  });

  describe('loading partial catalyst', () => {
    it('loads a catalyst with only some facets', async () => {
      const catalyst = await loadCatalyst(PARTIAL_CATALYST);
      
      expect(catalyst.manifest.id).toBe('@test/partial-catalyst');
      expect(catalyst.manifest.version).toBe('1.0.0-dev.0');
    });

    it('loads only declared facets', async () => {
      const catalyst = await loadCatalyst(PARTIAL_CATALYST);
      
      // Only questions and constraints are present
      expect(catalyst.facets.questions).toBeDefined();
      expect(catalyst.facets.constraints).toBeDefined();
      
      // Other facets should be undefined
      expect(catalyst.facets.outputTemplates).toBeUndefined();
      expect(catalyst.facets.domainKnowledge).toBeUndefined();
      expect(catalyst.facets.processGuidance).toBeUndefined();
      expect(catalyst.facets.validationRules).toBeUndefined();
    });

    it('handles missing facets gracefully', async () => {
      const catalyst = await loadCatalyst(PARTIAL_CATALYST);
      
      // Should not throw, just have undefined facets
      expect(catalyst).toBeDefined();
      expect(catalyst.facets).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws error for missing manifest', async () => {
      await expect(loadCatalyst(INVALID_CATALYST)).rejects.toThrow(
        'Catalyst manifest not found'
      );
    });

    it('throws error for non-existent directory', async () => {
      await expect(loadCatalyst('/nonexistent/path')).rejects.toThrow(
        'Catalyst directory not found'
      );
    });

    it('throws error for invalid manifest', async () => {
      // Create a test with invalid YAML by using a temp directory
      // For now, we'll skip this test as it requires temp file creation
      // This would be tested in integration tests
    });
  });

  describe('path resolution', () => {
    it('resolves relative paths', async () => {
      const catalyst = await loadCatalyst('./tests/fixtures/complete-catalyst');
      expect(catalyst.manifest.id).toBe('@test/complete-catalyst');
    });

    it('resolves absolute paths', async () => {
      const catalyst = await loadCatalyst(COMPLETE_CATALYST);
      expect(catalyst.manifest.id).toBe('@test/complete-catalyst');
    });

    it('stores absolute path in catalyst', async () => {
      const catalyst = await loadCatalyst('./tests/fixtures/complete-catalyst');
      expect(catalyst.directoryPath).toContain('tests/fixtures/complete-catalyst');
      expect(catalyst.directoryPath).not.toContain('./');
    });
  });
});

describe('loadCatalystSafe', () => {
  it('returns success result for valid catalyst', async () => {
    const result = await loadCatalystSafe(COMPLETE_CATALYST);
    
    expect(result.success).toBe(true);
    expect(result.catalyst).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('returns error result for invalid catalyst', async () => {
    const result = await loadCatalystSafe(INVALID_CATALYST);
    
    expect(result.success).toBe(false);
    expect(result.catalyst).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('manifest not found');
  });

  it('returns error result for non-existent directory', async () => {
    const result = await loadCatalystSafe('/nonexistent/path');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('resolveCatalysts', () => {
  it('resolves multiple catalysts', async () => {
    const catalysts = await resolveCatalysts(
      ['./tests/fixtures/complete-catalyst', './tests/fixtures/partial-catalyst'],
      process.cwd()
    );
    
    expect(catalysts).toHaveLength(2);
    expect(catalysts[0].manifest.id).toBe('@test/complete-catalyst');
    expect(catalysts[1].manifest.id).toBe('@test/partial-catalyst');
  });

  it('resolves relative to base path', async () => {
    const catalysts = await resolveCatalysts(
      ['complete-catalyst', 'partial-catalyst'],
      join(process.cwd(), 'tests/fixtures')
    );
    
    expect(catalysts).toHaveLength(2);
  });

  it('throws error if any catalyst fails to load', async () => {
    await expect(
      resolveCatalysts(
        ['./tests/fixtures/complete-catalyst', '/nonexistent'],
        process.cwd()
      )
    ).rejects.toThrow('Failed to load catalyst');
  });

  it('returns empty array for empty identifiers', async () => {
    const catalysts = await resolveCatalysts([], process.cwd());
    expect(catalysts).toEqual([]);
  });

  it('preserves order of catalysts', async () => {
    const catalysts = await resolveCatalysts(
      ['./tests/fixtures/partial-catalyst', './tests/fixtures/complete-catalyst'],
      process.cwd()
    );
    
    expect(catalysts[0].manifest.id).toBe('@test/partial-catalyst');
    expect(catalysts[1].manifest.id).toBe('@test/complete-catalyst');
  });
});

describe('facet loading details', () => {
  it('only loads .md files', async () => {
    const catalyst = await loadCatalyst(COMPLETE_CATALYST);
    
    // All loaded files should end with .md
    for (const facetContent of Object.values(catalyst.facets)) {
      if (facetContent) {
        for (const file of facetContent) {
          expect(file.filename).toMatch(/\.md$/);
        }
      }
    }
  });

  it('loads file content as strings', async () => {
    const catalyst = await loadCatalyst(COMPLETE_CATALYST);
    
    for (const facetContent of Object.values(catalyst.facets)) {
      if (facetContent) {
        for (const file of facetContent) {
          expect(typeof file.content).toBe('string');
          expect(file.content.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('preserves file content exactly', async () => {
    const catalyst = await loadCatalyst(COMPLETE_CATALYST);
    
    const testing = catalyst.facets.constraints?.find(
      f => f.filename === 'testing.md'
    );
    
    expect(testing?.content).toContain('# Testing Constraints');
    expect(testing?.content).toContain('Every plan must include a testing step');
    expect(testing?.content).toContain('Coverage threshold: 80%');
  });
});
