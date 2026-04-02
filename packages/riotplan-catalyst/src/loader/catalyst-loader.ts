/**
 * Catalyst loading from local directories
 * @packageDocumentation
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { 
    CatalystManifestSchema, 
    FACET_DIRECTORIES,
    type FacetType,
} from '@/schema/schemas.js';
import type { 
    Catalyst, 
    CatalystManifest, 
    CatalystFacets, 
    FacetContent,
    CatalystLoadOptions,
    CatalystLoadResult,
} from '@/types.js';

/**
 * Load a catalyst manifest from catalyst.yml
 * @param directoryPath - Absolute path to catalyst directory
 * @returns Parsed and validated manifest
 * @throws Error if manifest is missing or invalid
 */
async function loadManifest(directoryPath: string): Promise<CatalystManifest> {
    const manifestPath = join(directoryPath, 'catalyst.yml');
  
    try {
        const content = await readFile(manifestPath, 'utf-8');
        const parsed = parseYaml(content);
    
        // Validate with Zod schema
        const result = CatalystManifestSchema.safeParse(parsed);
    
        if (!result.success) {
            const errors = result.error.issues.map(issue => 
                `${issue.path.join('.')}: ${issue.message}`
            ).join('; ');
            throw new Error(`Invalid catalyst manifest: ${errors}`);
        }
    
        return result.data;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Catalyst manifest not found at ${manifestPath}`);
        }
        throw error;
    }
}

/**
 * Load all markdown files from a facet directory
 * @param facetPath - Path to facet directory
 * @returns Array of FacetContent objects
 */
async function loadFacetFiles(facetPath: string): Promise<FacetContent[]> {
    try {
        const entries = await readdir(facetPath, { withFileTypes: true });
        const markdownFiles = entries.filter(
            entry => entry.isFile() && entry.name.endsWith('.md')
        );
    
        const contents = await Promise.all(
            markdownFiles.map(async (file) => {
                const filePath = join(facetPath, file.name);
                const content = await readFile(filePath, 'utf-8');
                return {
                    filename: file.name,
                    content,
                };
            })
        );
    
        return contents;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // Directory doesn't exist - return empty array
            return [];
        }
        throw error;
    }
}

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Load all facets from a catalyst directory
 * @param directoryPath - Absolute path to catalyst directory
 * @param manifest - Parsed manifest (for cross-referencing)
 * @param options - Load options
 * @returns Loaded facets and any warnings
 */
async function loadFacets(
    directoryPath: string,
    manifest: CatalystManifest,
    options: CatalystLoadOptions = {}
): Promise<{ facets: CatalystFacets; warnings: string[] }> {
    const facets: CatalystFacets = {};
    const warnings: string[] = [];
  
    // Load each facet type
    for (const [facetKey, dirName] of Object.entries(FACET_DIRECTORIES)) {
        const facetType = facetKey as FacetType;
        const facetPath = join(directoryPath, dirName);
        const exists = await directoryExists(facetPath);
    
        // Check if facet is declared in manifest
        const declared = manifest.facets?.[facetType];
    
        if (exists) {
            // Load the facet content
            const content = await loadFacetFiles(facetPath);
            if (content.length > 0) {
                facets[facetType] = content;
            }
      
            // Warn if present but explicitly declared as false
            if (declared === false && options.warnOnUndeclaredFacets) {
                warnings.push(
                    `Facet '${facetType}' is present but declared as false in manifest`
                );
            }
        } else {
            // Warn if declared but missing
            if (declared === true && options.warnOnMissingFacets) {
                warnings.push(
                    `Facet '${facetType}' is declared in manifest but directory '${dirName}' not found`
                );
            }
        }
    }
  
    return { facets, warnings };
}

/**
 * Load a catalyst from a local directory
 * 
 * Reads the catalyst.yml manifest, validates it, and loads all facet content
 * from the directory structure.
 * 
 * @param directoryPath - Path to catalyst directory (absolute or relative)
 * @param options - Load options
 * @returns Loaded catalyst
 * @throws Error if manifest is missing or invalid
 * 
 * @example
 * ```typescript
 * const catalyst = await loadCatalyst('./my-catalyst');
 * console.log(catalyst.manifest.name);
 * console.log(catalyst.facets.constraints?.length);
 * ```
 */
export async function loadCatalyst(
    directoryPath: string,
    options: CatalystLoadOptions = {}
): Promise<Catalyst> {
    // Resolve to absolute path
    const absolutePath = resolve(directoryPath);
  
    // Check if directory exists
    if (!await directoryExists(absolutePath)) {
        throw new Error(`Catalyst directory not found: ${absolutePath}`);
    }
  
    // Load and validate manifest
    const manifest = await loadManifest(absolutePath);
  
    // Load all facets
    const { facets, warnings } = await loadFacets(absolutePath, manifest, options);
  
    // Log warnings if any
    if (warnings.length > 0 && !options.strict) {
        for (const warning of warnings) {
            // eslint-disable-next-line no-console
            console.warn(`[catalyst-loader] ${warning}`);
        }
    }
  
    return {
        manifest,
        facets,
        directoryPath: absolutePath,
    };
}

/**
 * Load a catalyst with full error handling
 * 
 * Like loadCatalyst but returns a result object instead of throwing
 * 
 * @param directoryPath - Path to catalyst directory
 * @param options - Load options
 * @returns Result object with success/error
 */
export async function loadCatalystSafe(
    directoryPath: string,
    options: CatalystLoadOptions = {}
): Promise<CatalystLoadResult> {
    try {
        const catalyst = await loadCatalyst(directoryPath, options);
        return {
            success: true,
            catalyst,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Resolve catalyst identifiers to directories and load them
 * 
 * Phase 1: Only supports local directory paths (absolute or relative)
 * Phase 2 (future): Will support NPM package resolution from node_modules
 * 
 * @param identifiers - Array of catalyst paths
 * @param basePath - Base path for resolving relative paths
 * @param options - Load options
 * @returns Array of loaded catalysts
 */
export async function resolveCatalysts(
    identifiers: string[],
    basePath: string = process.cwd(),
    options: CatalystLoadOptions = {}
): Promise<Catalyst[]> {
    const catalysts: Catalyst[] = [];
  
    for (const identifier of identifiers) {
    // Phase 1: treat identifier as a path
    // If it's relative, resolve from basePath
        const path = resolve(basePath, identifier);
    
        try {
            const catalyst = await loadCatalyst(path, options);
            catalysts.push(catalyst);
        } catch (error) {
            throw new Error(
                `Failed to load catalyst '${identifier}': ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
  
    return catalysts;
}
