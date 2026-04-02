import { describe, it, expect } from 'vitest';
import { 
  CatalystManifestSchema, 
  PlanManifestSchema,
  FacetsDeclarationSchema,
  FACET_DIRECTORIES,
  FACET_TYPES,
} from '@/schema/schemas';

describe('CatalystManifestSchema', () => {
  describe('valid manifests', () => {
    it('validates a complete manifest with all fields', () => {
      const manifest = {
        id: '@kjerneverk/catalyst-nodejs',
        name: 'Node.js Catalyst',
        description: 'Guidelines for Node.js development',
        version: '1.0.0',
        facets: {
          questions: true,
          constraints: true,
          outputTemplates: false,
          domainKnowledge: true,
          processGuidance: false,
          validationRules: true,
        },
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('validates a minimal manifest without facets', () => {
      const manifest = {
        id: 'simple-catalyst',
        name: 'Simple Catalyst',
        description: 'A simple catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('validates scoped package names', () => {
      const manifest = {
        id: '@my-org/my-catalyst',
        name: 'My Catalyst',
        description: 'A catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('validates unscoped package names', () => {
      const manifest = {
        id: 'my-catalyst',
        name: 'My Catalyst',
        description: 'A catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('validates dev versions', () => {
      const manifest = {
        id: 'catalyst',
        name: 'Catalyst',
        description: 'A catalyst',
        version: '1.0.0-dev.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('validates alpha/beta versions', () => {
      const manifest = {
        id: 'catalyst',
        name: 'Catalyst',
        description: 'A catalyst',
        version: '2.0.0-alpha.1',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid manifests', () => {
    it('rejects missing required fields', () => {
      const manifest = {
        id: '@kjerneverk/catalyst-nodejs',
        // missing name, description, version
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const manifest = {
        id: 'catalyst',
        name: '',
        description: 'A catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('empty');
      }
    });

    it('rejects empty description', () => {
      const manifest = {
        id: 'catalyst',
        name: 'Catalyst',
        description: '',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid version format', () => {
      const manifest = {
        id: 'catalyst',
        name: 'Catalyst',
        description: 'A catalyst',
        version: 'v1.0.0', // invalid: has 'v' prefix
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('semver');
      }
    });

    it('rejects invalid package name format', () => {
      const manifest = {
        id: '@invalid//package', // invalid: double slash
        name: 'Catalyst',
        description: 'A catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('NPM package name');
      }
    });

    it('rejects package names with spaces', () => {
      const manifest = {
        id: 'my catalyst',
        name: 'Catalyst',
        description: 'A catalyst',
        version: '1.0.0',
      };
      
      const result = CatalystManifestSchema.safeParse(manifest);
      expect(result.success).toBe(false);
    });
  });
});

describe('PlanManifestSchema', () => {
  describe('valid manifests', () => {
    it('validates a complete plan manifest', () => {
      const plan = {
        id: 'my-plan',
        title: 'My Plan',
        catalysts: ['@kjerneverk/catalyst-nodejs', 'simple-catalyst'],
        created: '2026-02-08T12:00:00Z',
        metadata: {
          author: 'test',
          priority: 'high',
        },
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('validates a minimal plan manifest', () => {
      const plan = {
        id: 'my-plan',
        title: 'My Plan',
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('validates empty catalysts array', () => {
      const plan = {
        id: 'my-plan',
        title: 'My Plan',
        catalysts: [],
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid manifests', () => {
    it('rejects missing id', () => {
      const plan = {
        title: 'My Plan',
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('rejects missing title', () => {
      const plan = {
        id: 'my-plan',
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('rejects empty id', () => {
      const plan = {
        id: '',
        title: 'My Plan',
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('rejects empty title', () => {
      const plan = {
        id: 'my-plan',
        title: '',
      };
      
      const result = PlanManifestSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });
});

describe('FacetsDeclarationSchema', () => {
  it('validates all facets declared', () => {
    const facets = {
      questions: true,
      constraints: true,
      outputTemplates: true,
      domainKnowledge: true,
      processGuidance: true,
      validationRules: true,
    };
    
    const result = FacetsDeclarationSchema.safeParse(facets);
    expect(result.success).toBe(true);
  });

  it('validates partial facets', () => {
    const facets = {
      questions: true,
      constraints: false,
    };
    
    const result = FacetsDeclarationSchema.safeParse(facets);
    expect(result.success).toBe(true);
  });

  it('validates empty object', () => {
    const facets = {};
    
    const result = FacetsDeclarationSchema.safeParse(facets);
    expect(result.success).toBe(true);
  });
});

describe('Constants', () => {
  it('has correct facet directory mappings', () => {
    expect(FACET_DIRECTORIES.questions).toBe('questions');
    expect(FACET_DIRECTORIES.constraints).toBe('constraints');
    expect(FACET_DIRECTORIES.outputTemplates).toBe('output-templates');
    expect(FACET_DIRECTORIES.domainKnowledge).toBe('domain-knowledge');
    expect(FACET_DIRECTORIES.processGuidance).toBe('process-guidance');
    expect(FACET_DIRECTORIES.validationRules).toBe('validation-rules');
  });

  it('has all six facet types', () => {
    expect(FACET_TYPES).toHaveLength(6);
    expect(FACET_TYPES).toContain('questions');
    expect(FACET_TYPES).toContain('constraints');
    expect(FACET_TYPES).toContain('outputTemplates');
    expect(FACET_TYPES).toContain('domainKnowledge');
    expect(FACET_TYPES).toContain('processGuidance');
    expect(FACET_TYPES).toContain('validationRules');
  });
});
