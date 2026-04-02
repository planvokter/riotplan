/**
 * Facet merging for multiple catalysts
 * @packageDocumentation
 */

import type { Catalyst } from '@/types.js';
import type { FacetType } from '@/schema/schemas.js';
import { FACET_TYPES } from '@/schema/schemas.js';

/**
 * A single piece of content with source attribution
 */
export interface AttributedContent {
  content: string;
  sourceId: string;
  filename?: string;
}

/**
 * Facets merged from multiple catalysts with source attribution
 */
export interface MergedFacets {
  questions?: AttributedContent[];
  constraints?: AttributedContent[];
  outputTemplates?: AttributedContent[];
  domainKnowledge?: AttributedContent[];
  processGuidance?: AttributedContent[];
  validationRules?: AttributedContent[];
}

/**
 * Result of merging multiple catalysts
 */
export interface MergedCatalyst {
  /** Ordered list of catalyst IDs that were merged */
  catalystIds: string[];
  /** Merged facets with source attribution */
  facets: MergedFacets;
  /** Metadata about each catalyst's contribution */
  contributions: Map<string, {
    facetTypes: FacetType[];
    contentCount: number;
  }>;
}

/**
 * Merge multiple catalysts in order
 * 
 * Catalysts are merged in the order provided, with later catalysts
 * layering on top of earlier ones. Content is concatenated (no conflict
 * resolution in v1), and each piece of content retains its source catalyst ID.
 * 
 * @param catalysts - Ordered array of catalysts to merge (can be empty)
 * @returns Merged catalyst with source attribution
 * 
 * @example
 * ```typescript
 * const catalyst1 = await loadCatalyst('./base-catalyst');
 * const catalyst2 = await loadCatalyst('./nodejs-catalyst');
 * const merged = mergeCatalysts([catalyst1, catalyst2]);
 * ```
 */
export function mergeCatalysts(catalysts: Catalyst[]): MergedCatalyst {
    const mergedFacets: MergedFacets = {};
    const catalystIds = catalysts.map(c => c.manifest.id);
    const contributions = new Map<string, {
    facetTypes: FacetType[];
    contentCount: number;
  }>();

    // Process each facet type
    for (const facetType of FACET_TYPES) {
        const mergedContent: AttributedContent[] = [];

        // Iterate through catalysts in order
        for (const catalyst of catalysts) {
            const facetContent = catalyst.facets[facetType];
      
            if (facetContent && facetContent.length > 0) {
                // Add each file's content with source attribution
                for (const file of facetContent) {
                    mergedContent.push({
                        content: file.content,
                        sourceId: catalyst.manifest.id,
                        filename: file.filename,
                    });
                }

                // Track contribution
                const contrib = contributions.get(catalyst.manifest.id) || {
                    facetTypes: [],
                    contentCount: 0,
                };
                if (!contrib.facetTypes.includes(facetType)) {
                    contrib.facetTypes.push(facetType);
                }
                contrib.contentCount += facetContent.length;
                contributions.set(catalyst.manifest.id, contrib);
            }
        }

        // Only set facet type if there's content
        if (mergedContent.length > 0) {
            mergedFacets[facetType] = mergedContent;
        }
    }

    return {
        catalystIds,
        facets: mergedFacets,
        contributions,
    };
}

/**
 * Format a facet type name for display
 */
function formatFacetName(facetType: FacetType): string {
    const names: Record<FacetType, string> = {
        questions: 'Questions',
        constraints: 'Constraints',
        outputTemplates: 'Output Templates',
        domainKnowledge: 'Domain Knowledge',
        processGuidance: 'Process Guidance',
        validationRules: 'Validation Rules',
    };
    return names[facetType];
}

/**
 * Render merged facet content into a prompt-ready string
 * 
 * Groups content by catalyst source and formats it for use in AI prompts.
 * Each source is labeled and content is separated for readability.
 * 
 * @param merged - Merged catalyst
 * @param facetType - Facet type to render
 * @returns Formatted string ready for prompt injection, or empty string if no content
 * 
 * @example
 * ```typescript
 * const merged = mergeCatalysts([catalyst1, catalyst2]);
 * const constraints = renderFacet(merged, 'constraints');
 * // Returns:
 * // From @kjerneverk/base-catalyst:
 * // [content from first catalyst]
 * // From @kjerneverk/nodejs-catalyst:
 * // [content from second catalyst]
 * ```
 */
export function renderFacet(
    merged: MergedCatalyst, 
    facetType: FacetType
): string {
    const content = merged.facets[facetType];
  
    if (!content || content.length === 0) {
        return '';
    }

    const lines: string[] = [];
    let currentSource = '';

    for (const item of content) {
    // Add source header when it changes
        if (item.sourceId !== currentSource) {
            if (lines.length > 0) {
                lines.push(''); // Blank line between sources
            }
            lines.push(`From ${item.sourceId}:`);
            currentSource = item.sourceId;
        }

        // Add content
        lines.push(item.content);
    }

    return lines.join('\n');
}

/**
 * Render all facets from a merged catalyst
 * 
 * Returns an object with each facet type mapped to its rendered string.
 * Empty strings for facets with no content.
 * 
 * @param merged - Merged catalyst
 * @returns Object with all facets rendered
 */
export function renderAllFacets(merged: MergedCatalyst): Record<FacetType, string> {
    const rendered: Partial<Record<FacetType, string>> = {};

    for (const facetType of FACET_TYPES) {
        rendered[facetType] = renderFacet(merged, facetType);
    }

    return rendered as Record<FacetType, string>;
}

/**
 * Generate a summary of merged catalysts
 * 
 * Returns human-readable text about what was merged and what each
 * catalyst contributed.
 * 
 * @param merged - Merged catalyst
 * @returns Summary string
 */
export function summarizeMerge(merged: MergedCatalyst): string {
    if (merged.catalystIds.length === 0) {
        return 'No catalysts merged';
    }

    const lines: string[] = [];
    lines.push(`Merged ${merged.catalystIds.length} catalyst(s):`);
    lines.push('');

    for (const [catalystId, contrib] of merged.contributions) {
        lines.push(`- ${catalystId}:`);
        lines.push(`  - Facets: ${contrib.facetTypes.map(t => formatFacetName(t)).join(', ')}`);
        lines.push(`  - Content items: ${contrib.contentCount}`);
    }

    return lines.join('\n');
}
