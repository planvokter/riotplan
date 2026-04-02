/**
 * Zod schemas for catalyst.yml and plan.yaml manifests
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Facet directory names as they appear on disk
 */
export const FACET_DIRECTORIES = {
    questions: 'questions',
    constraints: 'constraints',
    outputTemplates: 'output-templates',
    domainKnowledge: 'domain-knowledge',
    processGuidance: 'process-guidance',
    validationRules: 'validation-rules',
} as const;

/**
 * All valid facet types
 */
export const FACET_TYPES = [
    'questions',
    'constraints',
    'outputTemplates',
    'domainKnowledge',
    'processGuidance',
    'validationRules',
] as const;

export type FacetType = typeof FACET_TYPES[number];

/**
 * Schema for the facets declaration in catalyst.yml
 * Each facet can be declared as present (true) or explicitly absent (false)
 */
export const FacetsDeclarationSchema = z.object({
    questions: z.boolean().optional().describe('Whether this catalyst provides guiding questions'),
    constraints: z.boolean().optional().describe('Whether this catalyst provides constraints/rules'),
    outputTemplates: z.boolean().optional().describe('Whether this catalyst provides output templates'),
    domainKnowledge: z.boolean().optional().describe('Whether this catalyst provides domain knowledge'),
    processGuidance: z.boolean().optional().describe('Whether this catalyst provides process guidance'),
    validationRules: z.boolean().optional().describe('Whether this catalyst provides validation rules'),
});

/**
 * Semver pattern for version validation
 * Matches: 1.0.0, 1.0.0-dev.0, 1.0.0-alpha.1, etc.
 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

/**
 * NPM package name pattern
 * Matches: @scope/name, name, @scope/name-with-dashes
 */
const NPM_PACKAGE_PATTERN = /^(@[\w-]+\/)?[\w-]+$/;

/**
 * Schema for catalyst.yml manifest file
 * 
 * The manifest defines the catalyst's identity and declares which facets it provides.
 * Facets are optional - a catalyst can provide any subset of the six facet types.
 */
export const CatalystManifestSchema = z.object({
    /** 
   * Catalyst identifier - should match NPM package name
   * @example "@kjerneverk/catalyst-nodejs"
   */
    id: z.string()
        .regex(NPM_PACKAGE_PATTERN, 'ID must be a valid NPM package name (e.g., @scope/name or name)')
        .describe('Catalyst identifier (NPM package name)'),
  
    /** Human-readable name for display */
    name: z.string()
        .min(1, 'Name cannot be empty')
        .describe('Human-readable name'),
  
    /** Description of what this catalyst provides */
    description: z.string()
        .min(1, 'Description cannot be empty')
        .describe('What this catalyst provides'),
  
    /** 
   * Semver version string
   * @example "1.0.0" or "1.0.0-dev.0"
   */
    version: z.string()
        .regex(SEMVER_PATTERN, 'Version must be valid semver (e.g., 1.0.0 or 1.0.0-dev.0)')
        .describe('Semver version'),
  
    /** 
   * Declaration of which facets this catalyst provides
   * If omitted, facets are auto-detected from directory structure
   */
    facets: FacetsDeclarationSchema.optional()
        .describe('Declaration of which facets this catalyst provides'),
});

/**
 * Schema for plan.yaml manifest file
 * 
 * The plan manifest gives each plan an identity and records which catalysts
 * are associated with it.
 */
export const PlanManifestSchema = z.object({
    /** Plan identifier (typically kebab-case) */
    id: z.string()
        .min(1, 'ID cannot be empty')
        .describe('Plan identifier'),
  
    /** Human-readable title */
    title: z.string()
        .min(1, 'Title cannot be empty')
        .describe('Human-readable title'),
  
    /** 
   * Ordered list of catalyst IDs associated with this plan
   * Catalysts are applied in order (first = base, last = top layer)
   */
    catalysts: z.array(z.string())
        .optional()
        .describe('Ordered list of catalyst IDs'),
  
    /** ISO timestamp of when the plan was created */
    created: z.string()
        .optional()
        .describe('ISO timestamp of creation'),
  
    /** Extensible metadata for future use */
    metadata: z.record(z.string())
        .optional()
        .describe('Extensible metadata'),
});

/**
 * Inferred TypeScript types from Zod schemas
 */
export type CatalystManifestInput = z.input<typeof CatalystManifestSchema>;
export type CatalystManifestOutput = z.output<typeof CatalystManifestSchema>;
export type PlanManifestInput = z.input<typeof PlanManifestSchema>;
export type PlanManifestOutput = z.output<typeof PlanManifestSchema>;
export type FacetsDeclaration = z.infer<typeof FacetsDeclarationSchema>;
