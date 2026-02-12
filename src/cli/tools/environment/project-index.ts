/**
 * Project Index Tool
 * 
 * Builds and queries a local index of project files to minimize LLM round-trips.
 * The index includes file structure, exports, and metadata.
 */

import { resolve, relative, extname, basename, dirname } from 'node:path';
import { readdir, stat, readFile } from 'node:fs/promises';
import type { Tool } from '@kjerneverk/agentic';

// Default ignore patterns
const DEFAULT_IGNORE = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '.turbo',
    '__pycache__',
    '.pytest_cache',
    'target',  // Rust
    'vendor',  // Go
];

// File extensions to analyze for exports/public symbols, grouped by language
const ANALYZABLE_EXTENSIONS: Record<string, string[]> = {
    // JavaScript/TypeScript
    js: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    // Python
    python: ['.py'],
    // Rust
    rust: ['.rs'],
    // Java/Kotlin
    java: ['.java', '.kt'],
    // Go
    go: ['.go'],
    // C/C++
    c: ['.h', '.hpp', '.hxx'],  // Headers define public API
};

// Flattened set for quick lookup
const ALL_ANALYZABLE_EXTENSIONS = new Set(
    Object.values(ANALYZABLE_EXTENSIONS).flat()
);

// Source file extensions to include in the index (broader than analyzable)
const _SOURCE_EXTENSIONS = new Set([
    // JS/TS
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    // Python
    '.py', '.pyi',
    // Rust
    '.rs',
    // Java/Kotlin
    '.java', '.kt', '.kts',
    // Go
    '.go',
    // C/C++
    '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
    // C#
    '.cs',
    // Ruby
    '.rb',
    // Swift
    '.swift',
    // Config/Build
    '.toml', '.yaml', '.yml', '.json',
    // Docs
    '.md',
]);

/**
 * A file entry in the index
 */
interface FileEntry {
    path: string;           // Relative path from root
    name: string;           // File name
    ext: string;            // Extension
    size: number;           // File size in bytes
    isDirectory: boolean;
    exports?: string[];     // Exported symbols (for JS/TS files)
    description?: string;   // First line comment or package description
}

/**
 * A package entry (for monorepos)
 */
interface PackageEntry {
    name: string;
    path: string;
    version?: string;
    description?: string;
    dependencies?: string[];
    devDependencies?: string[];
    main?: string;
    exports?: Record<string, string>;
}

/**
 * The full project index
 */
interface ProjectIndex {
    root: string;
    packages: PackageEntry[];
    files: FileEntry[];
    totalFiles: number;
    totalSize: number;
    indexedAt: string;
}

// In-memory cache of indexes
const indexCache: Map<string, ProjectIndex> = new Map();

/**
 * Check if a path should be ignored
 */
function shouldIgnore(name: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some(pattern => {
        if (pattern.includes('*')) {
            // Simple glob matching
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(name);
        }
        return name === pattern;
    });
}

/**
 * Detect language from file extension
 */
function detectLanguage(ext: string): string {
    if (ANALYZABLE_EXTENSIONS.js.includes(ext)) return 'js';
    if (ANALYZABLE_EXTENSIONS.python.includes(ext)) return 'python';
    if (ANALYZABLE_EXTENSIONS.rust.includes(ext)) return 'rust';
    if (ANALYZABLE_EXTENSIONS.java.includes(ext)) return 'java';
    if (ANALYZABLE_EXTENSIONS.go.includes(ext)) return 'go';
    if (ANALYZABLE_EXTENSIONS.c.includes(ext)) return 'c';
    return 'unknown';
}

/**
 * Extract public symbols from a source file (language-aware)
 */
async function extractExports(filePath: string): Promise<string[]> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const ext = extname(filePath);
        const lang = detectLanguage(ext);
        const exports: string[] = [];

        const patterns: RegExp[] = [];

        switch (lang) {
            case 'js':
                patterns.push(
                    /export\s+(?:async\s+)?function\s+(\w+)/g,           // export function foo
                    /export\s+(?:const|let|var)\s+(\w+)/g,               // export const foo
                    /export\s+class\s+(\w+)/g,                           // export class Foo
                    /export\s+interface\s+(\w+)/g,                       // export interface Foo
                    /export\s+type\s+(\w+)/g,                            // export type Foo
                    /export\s+enum\s+(\w+)/g,                            // export enum Foo
                    /export\s+\{\s*([^}]+)\s*\}/g,                       // export { foo, bar }
                    /export\s+default\s+(?:class|function)?\s*(\w+)?/g,  // export default
                );
                break;
            case 'python':
                patterns.push(
                    /^def\s+(\w+)/gm,                                    // def foo (top-level functions)
                    /^class\s+(\w+)/gm,                                  // class Foo
                    /^(\w+)\s*=/gm,                                      // MODULE_CONST = ... (top-level assignments)
                );
                break;
            case 'rust':
                patterns.push(
                    /pub\s+(?:async\s+)?fn\s+(\w+)/g,                   // pub fn foo
                    /pub\s+struct\s+(\w+)/g,                             // pub struct Foo
                    /pub\s+enum\s+(\w+)/g,                               // pub enum Foo
                    /pub\s+trait\s+(\w+)/g,                              // pub trait Foo
                    /pub\s+type\s+(\w+)/g,                               // pub type Foo
                    /pub\s+mod\s+(\w+)/g,                                // pub mod foo
                );
                break;
            case 'java':
                patterns.push(
                    /public\s+(?:abstract\s+)?class\s+(\w+)/g,          // public class Foo
                    /public\s+interface\s+(\w+)/g,                       // public interface Foo
                    /public\s+enum\s+(\w+)/g,                            // public enum Foo
                    /public\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/g,   // public ... methodName(
                );
                break;
            case 'go':
                patterns.push(
                    /^func\s+(\p{Lu}\w*)/gmu,                           // func ExportedFunc (uppercase = exported)
                    /^type\s+(\p{Lu}\w*)/gmu,                           // type ExportedType
                    /^var\s+(\p{Lu}\w*)/gmu,                            // var ExportedVar
                    /^const\s+(\p{Lu}\w*)/gmu,                          // const ExportedConst
                );
                break;
            case 'c':
                // For headers, extract function declarations and type definitions
                patterns.push(
                    /(?:extern\s+)?(?:[\w*]+\s+)+(\w+)\s*\([^)]*\)\s*;/g,  // function declarations
                    /typedef\s+(?:struct|enum|union)?\s*\w*\s*{[^}]*}\s*(\w+)/g,  // typedef struct {} Foo
                    /typedef\s+\w+\s+(\w+)\s*;/g,                       // typedef int Foo;
                    /#define\s+(\w+)/g,                                   // #define MACRO
                );
                break;
        }

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1]) {
                    if (match[1].includes(',')) {
                        const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
                        exports.push(...names.filter(Boolean));
                    } else {
                        const name = match[1].trim();
                        // Filter out Python dunder methods and private symbols
                        if (lang === 'python' && (name.startsWith('_') || name.startsWith('__'))) continue;
                        exports.push(name);
                    }
                }
            }
        }
        
        return [...new Set(exports)]; // Deduplicate
    } catch {
        return [];
    }
}

/**
 * Get first line comment or description from a file (language-aware)
 */
async function getFileDescription(filePath: string): Promise<string | undefined> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').slice(0, 15);
        
        for (const line of lines) {
            // Skip empty lines and shebangs
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#!')) continue;

            // JSDoc / block comment: * description
            const blockMatch = trimmed.match(/^\*\s+(.+)$/);
            if (blockMatch && !blockMatch[1].startsWith('@')) {
                return blockMatch[1].trim();
            }
            
            // C-style single-line: // description
            const cStyleMatch = trimmed.match(/^\/\/[!/]?\s*(.+)$/);
            if (cStyleMatch) return cStyleMatch[1].trim();

            // Python/Ruby/Shell: # description
            const hashMatch = trimmed.match(/^#\s+(.+)$/);
            if (hashMatch) return hashMatch[1].trim();

            // Python docstring: """description or '''description
            const docstringMatch = trimmed.match(/^(?:"""|''')(.+?)(?:"""|''')?$/);
            if (docstringMatch) return docstringMatch[1].trim();

            // Rust doc comment: /// description
            const rustDocMatch = trimmed.match(/^\/\/\/\s*(.+)$/);
            if (rustDocMatch) return rustDocMatch[1].trim();

            // If we hit actual code without finding a comment, stop
            if (!trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                break;
            }
        }
        
        return undefined;
    } catch {
        return undefined;
    }
}

/**
 * Scan a directory and build file entries
 */
async function scanDirectory(
    dirPath: string,
    rootPath: string,
    ignorePatterns: string[],
    maxDepth: number,
    currentDepth: number = 0
): Promise<FileEntry[]> {
    if (currentDepth > maxDepth) return [];
    
    const entries: FileEntry[] = [];
    
    try {
        const items = await readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            if (shouldIgnore(item.name, ignorePatterns)) continue;
            
            const fullPath = resolve(dirPath, item.name);
            const relativePath = relative(rootPath, fullPath);
            
            if (item.isDirectory()) {
                entries.push({
                    path: relativePath,
                    name: item.name,
                    ext: '',
                    size: 0,
                    isDirectory: true,
                });
                
                // Recurse into subdirectory
                const subEntries = await scanDirectory(
                    fullPath,
                    rootPath,
                    ignorePatterns,
                    maxDepth,
                    currentDepth + 1
                );
                entries.push(...subEntries);
            } else {
                const stats = await stat(fullPath);
                const ext = extname(item.name);
                
                const entry: FileEntry = {
                    path: relativePath,
                    name: item.name,
                    ext,
                    size: stats.size,
                    isDirectory: false,
                };
                
                // Extract exports for analyzable source files (but only if small enough)
                if (ALL_ANALYZABLE_EXTENSIONS.has(ext) && stats.size < 100000) {
                    entry.exports = await extractExports(fullPath);
                    entry.description = await getFileDescription(fullPath);
                }
                
                entries.push(entry);
            }
        }
    } catch {
        // Ignore permission errors, etc.
    }
    
    return entries;
}

/**
 * Known project manifest files and their ecosystems
 */
const PROJECT_MANIFESTS: { file: string; ecosystem: string }[] = [
    { file: 'package.json', ecosystem: 'node' },
    { file: 'Cargo.toml', ecosystem: 'rust' },
    { file: 'pyproject.toml', ecosystem: 'python' },
    { file: 'setup.py', ecosystem: 'python' },
    { file: 'setup.cfg', ecosystem: 'python' },
    { file: 'go.mod', ecosystem: 'go' },
    { file: 'pom.xml', ecosystem: 'java' },
    { file: 'build.gradle', ecosystem: 'java' },
    { file: 'build.gradle.kts', ecosystem: 'kotlin' },
    { file: 'CMakeLists.txt', ecosystem: 'cmake' },
    { file: 'Makefile', ecosystem: 'make' },
    { file: '*.csproj', ecosystem: 'dotnet' },
    { file: 'Gemfile', ecosystem: 'ruby' },
    { file: 'Package.swift', ecosystem: 'swift' },
];

const MANIFEST_FILE_NAMES = new Set(PROJECT_MANIFESTS.map(m => m.file).filter(f => !f.includes('*')));

/**
 * Parse a project manifest file and extract package info
 */
async function parseManifest(filePath: string, fileName: string, rootPath: string): Promise<PackageEntry | null> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const dir = dirname(filePath);
        const relPath = relative(rootPath, dir);

        if (fileName === 'package.json') {
            const pkg = JSON.parse(content);
            return {
                name: pkg.name || basename(dir),
                path: relPath,
                version: pkg.version,
                description: pkg.description,
                dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : undefined,
                devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : undefined,
                main: pkg.main,
                exports: pkg.exports,
            };
        }

        if (fileName === 'Cargo.toml') {
            // Basic TOML parsing for [package] section
            const nameMatch = content.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/);
            const versionMatch = content.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
            const descMatch = content.match(/\[package\][\s\S]*?description\s*=\s*"([^"]+)"/);
            const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
            const deps = depsSection ? [...depsSection[1].matchAll(/^(\w[\w-]*)\s*=/gm)].map(m => m[1]) : undefined;
            return {
                name: nameMatch?.[1] || basename(dir),
                path: relPath,
                version: versionMatch?.[1],
                description: descMatch?.[1],
                dependencies: deps,
            };
        }

        if (fileName === 'pyproject.toml') {
            const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
            const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
            const descMatch = content.match(/description\s*=\s*"([^"]+)"/);
            const depsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
            const deps = depsMatch ? [...depsMatch[1].matchAll(/"([^">=<[]+)/g)].map(m => m[1].trim()) : undefined;
            return {
                name: nameMatch?.[1] || basename(dir),
                path: relPath,
                version: versionMatch?.[1],
                description: descMatch?.[1],
                dependencies: deps,
            };
        }

        if (fileName === 'go.mod') {
            const moduleMatch = content.match(/module\s+(\S+)/);
            const goMatch = content.match(/go\s+(\S+)/);
            const reqSection = content.match(/require\s*\(([\s\S]*?)\)/);
            const deps = reqSection ? [...reqSection[1].matchAll(/\s+(\S+)\s+/g)].map(m => m[1]) : undefined;
            return {
                name: moduleMatch?.[1] || basename(dir),
                path: relPath,
                version: goMatch?.[1],
                dependencies: deps,
            };
        }

        if (fileName === 'pom.xml') {
            const groupMatch = content.match(/<groupId>([^<]+)<\/groupId>/);
            const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
            const versionMatch = content.match(/<version>([^<]+)<\/version>/);
            const name = groupMatch && artifactMatch 
                ? `${groupMatch[1]}:${artifactMatch[1]}`
                : artifactMatch?.[1] || basename(dir);
            return {
                name,
                path: relPath,
                version: versionMatch?.[1],
            };
        }

        // For other manifests (Makefile, CMakeLists.txt, etc.), just record the project
        const manifest = PROJECT_MANIFESTS.find(m => m.file === fileName);
        return {
            name: basename(dir),
            path: relPath,
            description: `${manifest?.ecosystem || 'unknown'} project`,
        };
    } catch {
        return null;
    }
}

/**
 * Find and parse project manifests (language-agnostic)
 */
async function findPackages(rootPath: string, ignorePatterns: string[]): Promise<PackageEntry[]> {
    const packages: PackageEntry[] = [];
    
    async function scanForPackages(dirPath: string, depth: number = 0): Promise<void> {
        if (depth > 3) return; // Don't go too deep
        
        try {
            const items = await readdir(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                if (shouldIgnore(item.name, ignorePatterns)) continue;
                
                const fullPath = resolve(dirPath, item.name);
                
                if (item.isDirectory()) {
                    await scanForPackages(fullPath, depth + 1);
                } else if (MANIFEST_FILE_NAMES.has(item.name) || item.name.endsWith('.csproj')) {
                    const pkg = await parseManifest(fullPath, item.name, rootPath);
                    if (pkg) {
                        packages.push(pkg);
                    }
                }
            }
        } catch {
            // Ignore permission errors
        }
    }
    
    await scanForPackages(rootPath);
    return packages;
}

/**
 * Build a project index
 */
async function buildIndex(
    rootPath: string,
    options: {
        maxDepth?: number;
        ignorePatterns?: string[];
    } = {}
): Promise<ProjectIndex> {
    const maxDepth = options.maxDepth ?? 10;
    const ignorePatterns = [...DEFAULT_IGNORE, ...(options.ignorePatterns || [])];
    
    const [files, packages] = await Promise.all([
        scanDirectory(rootPath, rootPath, ignorePatterns, maxDepth),
        findPackages(rootPath, ignorePatterns),
    ]);
    
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    const index: ProjectIndex = {
        root: rootPath,
        packages,
        files,
        totalFiles: files.filter(f => !f.isDirectory).length,
        totalSize,
        indexedAt: new Date().toISOString(),
    };
    
    // Cache the index
    indexCache.set(rootPath, index);
    
    return index;
}

/**
 * Get or build an index for a path
 */
async function getIndex(rootPath: string): Promise<ProjectIndex> {
    const cached = indexCache.get(rootPath);
    if (cached) {
        return cached;
    }
    return buildIndex(rootPath);
}

// ===== TOOL IMPLEMENTATIONS =====

export interface IndexProjectParams {
    path: string;
    refresh?: boolean;
    maxDepth?: number;
    ignorePatterns?: string[];
}

export interface QueryIndexParams {
    path: string;
    query: string;
}

/**
 * Build or refresh the project index
 */
export async function indexProjectImpl(
    params: IndexProjectParams,
    workingDirectory: string
): Promise<string> {
    const rootPath = resolve(workingDirectory, params.path);
    
    if (params.refresh) {
        indexCache.delete(rootPath);
    }
    
    const index = await buildIndex(rootPath, {
        maxDepth: params.maxDepth,
        ignorePatterns: params.ignorePatterns,
    });
    
    // Return a summary
    const summary = [
        `## Project Index: ${index.root}`,
        ``,
        `**Indexed at:** ${index.indexedAt}`,
        `**Total files:** ${index.totalFiles}`,
        `**Total size:** ${(index.totalSize / 1024 / 1024).toFixed(2)} MB`,
        ``,
        `### Packages (${index.packages.length})`,
        ...index.packages.map(p => `- **${p.name}** (${p.path}): ${p.description || 'No description'}`),
        ``,
        `### Directory Structure`,
        ...index.files
            .filter(f => f.isDirectory)
            .slice(0, 50)
            .map(f => `- 📁 ${f.path}`),
        index.files.filter(f => f.isDirectory).length > 50 ? `- ... and ${index.files.filter(f => f.isDirectory).length - 50} more directories` : '',
    ].filter(Boolean);
    
    return summary.join('\n');
}

/**
 * Query the project index
 */
export async function queryIndexImpl(
    params: QueryIndexParams,
    workingDirectory: string
): Promise<string> {
    const rootPath = resolve(workingDirectory, params.path);
    const index = await getIndex(rootPath);
    const query = params.query.toLowerCase();
    
    const results: string[] = [];
    
    // Parse query intent
    if (query.includes('package') || query.includes('monorepo') || query.includes('workspace')) {
        // Package-related query
        results.push(`## Packages in ${index.root}`);
        results.push('');
        for (const pkg of index.packages) {
            results.push(`### ${pkg.name}`);
            results.push(`- **Path:** ${pkg.path}`);
            results.push(`- **Version:** ${pkg.version || 'N/A'}`);
            results.push(`- **Description:** ${pkg.description || 'N/A'}`);
            if (pkg.dependencies?.length) {
                results.push(`- **Dependencies:** ${pkg.dependencies.slice(0, 10).join(', ')}${pkg.dependencies.length > 10 ? '...' : ''}`);
            }
            results.push('');
        }
    } else if (query.includes('export') || query.includes('function') || query.includes('class')) {
        // Looking for exports
        const searchTerm = query.replace(/export|function|class|find|where|is/gi, '').trim();
        results.push(`## Exports matching "${searchTerm}"`);
        results.push('');
        
        for (const file of index.files) {
            if (!file.exports?.length) continue;
            
            const matches = file.exports.filter(e => 
                e.toLowerCase().includes(searchTerm) || searchTerm === ''
            );
            
            if (matches.length > 0) {
                results.push(`**${file.path}**`);
                results.push(`  Exports: ${matches.join(', ')}`);
            }
        }
        
        if (results.length === 2) {
            results.push('No matching exports found.');
        }
    } else if (query.includes('file') || query.includes('find')) {
        // File search
        const searchTerm = query.replace(/file|find|where|is|named?/gi, '').trim();
        results.push(`## Files matching "${searchTerm}"`);
        results.push('');
        
        const matches = index.files.filter(f => 
            f.name.toLowerCase().includes(searchTerm) ||
            f.path.toLowerCase().includes(searchTerm)
        ).slice(0, 50);
        
        for (const file of matches) {
            const icon = file.isDirectory ? '📁' : '📄';
            const size = file.isDirectory ? '' : ` (${(file.size / 1024).toFixed(1)} KB)`;
            results.push(`${icon} ${file.path}${size}`);
        }
        
        if (matches.length === 0) {
            results.push('No matching files found.');
        }
    } else if (query.includes('structure') || query.includes('overview') || query.includes('summary')) {
        // Project structure overview
        results.push(`## Project Structure: ${index.root}`);
        results.push('');
        results.push(`**Packages:** ${index.packages.length}`);
        results.push(`**Total files:** ${index.totalFiles}`);
        results.push(`**Total size:** ${(index.totalSize / 1024 / 1024).toFixed(2)} MB`);
        results.push('');
        results.push('### Packages');
        for (const pkg of index.packages) {
            results.push(`- **${pkg.name}**: ${pkg.description || pkg.path}`);
        }
        results.push('');
        results.push('### Top-level directories');
        const topDirs = index.files.filter(f => f.isDirectory && !f.path.includes('/'));
        for (const dir of topDirs) {
            results.push(`- 📁 ${dir.name}`);
        }
    } else if (query.includes('type') || query.includes('interface')) {
        // Looking for types/interfaces
        const searchTerm = query.replace(/type|interface|find|where|is/gi, '').trim();
        results.push(`## Types/Interfaces matching "${searchTerm}"`);
        results.push('');
        
        for (const file of index.files) {
            if (!file.exports?.length) continue;
            if (!file.ext.includes('ts')) continue;
            
            const matches = file.exports.filter(e => 
                e.toLowerCase().includes(searchTerm) || searchTerm === ''
            );
            
            if (matches.length > 0) {
                results.push(`**${file.path}**`);
                results.push(`  Exports: ${matches.join(', ')}`);
            }
        }
    } else {
        // General search - search everything
        results.push(`## Search results for "${query}"`);
        results.push('');
        
        // Search files
        const fileMatches = index.files.filter(f => 
            f.name.toLowerCase().includes(query) ||
            f.path.toLowerCase().includes(query) ||
            f.description?.toLowerCase().includes(query)
        ).slice(0, 20);
        
        if (fileMatches.length > 0) {
            results.push('### Files');
            for (const file of fileMatches) {
                const icon = file.isDirectory ? '📁' : '📄';
                results.push(`${icon} ${file.path}`);
                if (file.description) {
                    results.push(`   ${file.description}`);
                }
            }
            results.push('');
        }
        
        // Search exports
        const exportMatches: { file: string; exports: string[] }[] = [];
        for (const file of index.files) {
            if (!file.exports?.length) continue;
            const matches = file.exports.filter(e => e.toLowerCase().includes(query));
            if (matches.length > 0) {
                exportMatches.push({ file: file.path, exports: matches });
            }
        }
        
        if (exportMatches.length > 0) {
            results.push('### Exports');
            for (const match of exportMatches.slice(0, 20)) {
                results.push(`**${match.file}**: ${match.exports.join(', ')}`);
            }
            results.push('');
        }
        
        // Search packages
        const pkgMatches = index.packages.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
        
        if (pkgMatches.length > 0) {
            results.push('### Packages');
            for (const pkg of pkgMatches) {
                results.push(`**${pkg.name}**: ${pkg.description || pkg.path}`);
            }
        }
        
        if (results.length === 2) {
            results.push('No results found.');
        }
    }
    
    return results.join('\n');
}

// ===== TOOL DEFINITIONS =====

export const indexProjectTool: Tool = {
    name: 'index_project',
    description: 'Build an index of a project directory for fast querying. Scans files, packages, and exports. Use this once at the start of a session to enable fast project queries.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the project root directory to index',
            },
            refresh: {
                type: 'boolean',
                description: 'Force rebuild the index even if cached (default: false)',
            },
            maxDepth: {
                type: 'number',
                description: 'Maximum directory depth to scan (default: 10)',
            },
            ignorePatterns: {
                type: 'array',
                items: { type: 'string', description: 'Pattern to ignore' },
                description: 'Additional patterns to ignore (node_modules, .git, dist already ignored)',
            },
        },
        required: ['path'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: IndexProjectParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return indexProjectImpl(params, workingDirectory);
    },
};

export const queryIndexTool: Tool = {
    name: 'query_index',
    description: `Query the project index for fast local lookups without LLM round-trips. Supports queries like:
- "packages" or "monorepo structure" - list all packages
- "find file terminal" - find files matching a name
- "export AgentLoop" - find where a symbol is exported
- "structure" or "overview" - get project summary
- Any search term - searches files, exports, and packages`,
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the project root (must be indexed first)',
            },
            query: {
                type: 'string',
                description: 'Natural language query about the project structure',
            },
        },
        required: ['path', 'query'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: QueryIndexParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return queryIndexImpl(params, workingDirectory);
    },
};
