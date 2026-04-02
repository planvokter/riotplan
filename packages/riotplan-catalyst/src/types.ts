/**
 * TypeScript interfaces for the catalyst system
 * @packageDocumentation
 */

import type { FacetType } from '@/schema/schemas';

/**
 * Content loaded from a single facet file
 */
export interface FacetContent {
  /** Filename without path (e.g., "testing.md") */
  filename: string;
  /** Full content of the file */
  content: string;
}

/**
 * Container for all loaded facet content from a catalyst
 * Each facet type maps to an array of file contents
 */
export interface CatalystFacets {
  /** Guiding questions for idea exploration and shaping */
  questions?: FacetContent[];
  /** Constraints and rules the plan must satisfy */
  constraints?: FacetContent[];
  /** Templates for expected deliverables (press release, 6-pager, etc.) */
  outputTemplates?: FacetContent[];
  /** Context about the domain, organization, or technology */
  domainKnowledge?: FacetContent[];
  /** Guidance on how to run the planning process */
  processGuidance?: FacetContent[];
  /** Post-creation validation checks */
  validationRules?: FacetContent[];
}

/**
 * Parsed catalyst.yml manifest
 */
export interface CatalystManifest {
  /** Catalyst identifier (NPM package name) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this catalyst provides */
  description: string;
  /** Semver version */
  version: string;
  /** Declaration of which facets this catalyst provides */
  facets?: {
    questions?: boolean;
    constraints?: boolean;
    outputTemplates?: boolean;
    domainKnowledge?: boolean;
    processGuidance?: boolean;
    validationRules?: boolean;
  };
}

/**
 * A fully loaded catalyst with manifest and all facet content
 */
export interface Catalyst {
  /** Parsed manifest from catalyst.yml */
  manifest: CatalystManifest;
  /** Loaded content for each facet type */
  facets: CatalystFacets;
  /** Absolute path to the catalyst directory */
  directoryPath: string;
}

/**
 * Result of loading a catalyst - either success or error
 */
export interface CatalystLoadResult {
  success: boolean;
  catalyst?: Catalyst;
  error?: string;
  warnings?: string[];
}

/**
 * Options for loading a catalyst
 */
export interface CatalystLoadOptions {
  /** Whether to validate the manifest strictly */
  strict?: boolean;
  /** Whether to warn about declared but missing facets */
  warnOnMissingFacets?: boolean;
  /** Whether to warn about present but undeclared facets */
  warnOnUndeclaredFacets?: boolean;
}

/**
 * Mapping from facet type to directory name on disk
 */
export type FacetDirectoryMap = Record<FacetType, string>;

/**
 * Plan manifest stored in plan.yaml
 */
export interface PlanManifest {
  /** Plan identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Ordered list of catalyst IDs */
  catalysts?: string[];
  /** ISO timestamp of creation */
  created?: string;
  /** Extensible metadata */
  metadata?: Record<string, string>;
}

/**
 * Content with source attribution (used in merged catalysts)
 */
export interface AttributedContent {
  /** The actual content */
  content: string;
  /** ID of the source catalyst */
  sourceId: string;
  /** Original filename (for reference) */
  filename?: string;
}

/**
 * Merged catalysts with source tracking
 */
export interface MergedCatalyst {
  /** Ordered list of catalyst IDs that were merged */
  catalystIds: string[];
  /** Merged facets with source attribution */
  facets: Record<string, AttributedContent[] | undefined>;
  /** Metadata about each catalyst's contribution */
  contributions: Map<string, {
    facetTypes: string[];
    contentCount: number;
  }>;
}
