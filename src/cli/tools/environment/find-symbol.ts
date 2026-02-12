/**
 * find_symbol tool - Find where a symbol is defined, exported, and used
 * 
 * Given a symbol name (class, function, interface, type), finds:
 * 1. Where it's defined (file + line)
 * 2. Where it's exported from
 * 3. Where it's imported/used
 * 
 * This approximates IDE "Go to Definition" + "Find All References".
 */

import { spawn } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface FindSymbolParams {
    symbol: string;
    path?: string;
    /** Limit search to specific file types (e.g., "*.ts", "*.py") */
    file_pattern?: string;
    /** Include usage sites, not just definitions (default: true) */
    include_usages?: boolean;
}

interface SymbolLocation {
    file: string;
    line: number;
    kind: 'definition' | 'export' | 'import' | 'usage';
    context: string;  // The matching line
}

/**
 * Search for a symbol using ripgrep or native grep
 */
async function searchSymbol(
    symbol: string,
    targetPath: string,
    filePattern?: string
): Promise<string[]> {
    // Build patterns that match definitions, exports, and imports of the symbol
    // We search for the exact word to avoid partial matches
    const pattern = `\\b${symbol}\\b`;

    return new Promise((resolvePromise) => {
        const args: string[] = [
            '--line-number',
            '--no-heading',
            '--color=never',
            '--max-count=200',
        ];

        if (filePattern) {
            args.push('--glob', filePattern);
        }

        // Common ignores
        args.push('--glob', '!node_modules');
        args.push('--glob', '!.git');
        args.push('--glob', '!dist');
        args.push('--glob', '!build');
        args.push('--glob', '!coverage');
        args.push('--glob', '!target');
        args.push('--glob', '!__pycache__');
        args.push('--glob', '!*.min.js');
        args.push('--glob', '!*.map');

        args.push(pattern, targetPath);

        const rg = spawn('rg', args);
        let stdout = '';

        rg.stdout.on('data', (data) => { stdout += data.toString(); });
        rg.on('close', () => {
            resolvePromise(stdout.trim().split('\n').filter(Boolean));
        });
        rg.on('error', () => {
            // Fall back to grep
            const grepArgs = ['-rn', '--color=never', '-w', symbol, targetPath];
            if (filePattern) {
                grepArgs.splice(3, 0, '--include=' + filePattern);
            }
            grepArgs.push(
                '--exclude-dir=node_modules',
                '--exclude-dir=.git',
                '--exclude-dir=dist',
                '--exclude-dir=build',
            );
            const grep = spawn('grep', grepArgs);
            let out = '';
            grep.stdout.on('data', (d) => { out += d.toString(); });
            grep.on('close', () => {
                resolvePromise(out.trim().split('\n').filter(Boolean));
            });
        });
    });
}

/**
 * Classify a match as definition, export, import, or usage
 */
function classifyMatch(line: string, symbol: string): 'definition' | 'export' | 'import' | 'usage' {
    const trimmed = line.trim();

    // Import patterns (multiple languages)
    if (/^import\s/.test(trimmed)) return 'import';
    if (/^from\s/.test(trimmed)) return 'import';
    if (/^use\s/.test(trimmed)) return 'import';  // Rust
    if (/^require\s*\(/.test(trimmed)) return 'import';

    // Definition patterns
    const defPatterns = [
        // JS/TS
        new RegExp(`^(export\\s+)?(async\\s+)?function\\s+${symbol}\\b`),
        new RegExp(`^(export\\s+)?(const|let|var)\\s+${symbol}\\s*[=:]`),
        new RegExp(`^(export\\s+)?(abstract\\s+)?class\\s+${symbol}\\b`),
        new RegExp(`^(export\\s+)?interface\\s+${symbol}\\b`),
        new RegExp(`^(export\\s+)?type\\s+${symbol}\\b`),
        new RegExp(`^(export\\s+)?enum\\s+${symbol}\\b`),
        // Python
        new RegExp(`^(class|def)\\s+${symbol}\\b`),
        // Rust
        new RegExp(`^(pub\\s+)?(async\\s+)?(fn|struct|enum|trait|type|mod)\\s+${symbol}\\b`),
        // Java
        new RegExp(`^(public|protected|private)\\s+.*\\b(class|interface|enum)\\s+${symbol}\\b`),
        // Go
        new RegExp(`^(func|type)\\s+${symbol}\\b`),
        // C/C++
        new RegExp(`^(typedef|struct|class|enum)\\s+.*${symbol}`),
    ];

    for (const pattern of defPatterns) {
        if (pattern.test(trimmed)) return 'definition';
    }

    // Export patterns
    if (/^export\s*\{/.test(trimmed) && trimmed.includes(symbol)) return 'export';
    if (/^module\.exports/.test(trimmed)) return 'export';
    if (new RegExp(`^export\\s+.*\\b${symbol}\\b`).test(trimmed)) return 'export';

    return 'usage';
}

export async function findSymbolImpl(
    params: FindSymbolParams,
    workingDirectory: string
): Promise<string> {
    const targetPath = params.path
        ? (isAbsolute(params.path) ? params.path : resolve(workingDirectory, params.path))
        : workingDirectory;

    const includeUsages = params.include_usages ?? true;

    const rawMatches = await searchSymbol(params.symbol, targetPath, params.file_pattern);

    if (rawMatches.length === 0) {
        return `No matches found for symbol: ${params.symbol}`;
    }

    // Parse and classify matches
    const locations: SymbolLocation[] = [];
    for (const raw of rawMatches) {
        // Format: file:line:content
        const match = raw.match(/^(.+?):(\d+):(.*)$/);
        if (!match) continue;

        const [, file, lineStr, context] = match;
        const line = parseInt(lineStr, 10);
        const kind = classifyMatch(context, params.symbol);

        if (!includeUsages && kind === 'usage') continue;

        locations.push({ file, line, kind, context: context.trim() });
    }

    // Sort: definitions first, then exports, then imports, then usages
    const kindOrder: Record<string, number> = { definition: 0, export: 1, import: 2, usage: 3 };
    locations.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);

    // Format output
    const output: string[] = [`# Symbol: ${params.symbol}\n`];

    const defs = locations.filter(l => l.kind === 'definition');
    const exports = locations.filter(l => l.kind === 'export');
    const imports = locations.filter(l => l.kind === 'import');
    const usages = locations.filter(l => l.kind === 'usage');

    if (defs.length > 0) {
        output.push(`## Definitions (${defs.length})`);
        for (const d of defs) {
            output.push(`  ${d.file}:${d.line}  ${d.context}`);
        }
        output.push('');
    }

    if (exports.length > 0) {
        output.push(`## Exports (${exports.length})`);
        for (const e of exports) {
            output.push(`  ${e.file}:${e.line}  ${e.context}`);
        }
        output.push('');
    }

    if (imports.length > 0) {
        output.push(`## Imported by (${imports.length})`);
        for (const im of imports) {
            output.push(`  ${im.file}:${im.line}  ${im.context}`);
        }
        output.push('');
    }

    if (includeUsages && usages.length > 0) {
        output.push(`## Usages (${usages.length})`);
        for (const u of usages.slice(0, 50)) { // Cap usages at 50
            output.push(`  ${u.file}:${u.line}  ${u.context}`);
        }
        if (usages.length > 50) {
            output.push(`  ... and ${usages.length - 50} more usages`);
        }
        output.push('');
    }

    output.push(`Total: ${defs.length} definitions, ${exports.length} exports, ${imports.length} imports, ${usages.length} usages`);

    return output.join('\n');
}

export const findSymbolTool: Tool = {
    name: 'find_symbol',
    description: 'Find where a symbol (class, function, interface, type) is defined, exported, imported, and used across the codebase. Like IDE "Go to Definition" + "Find All References". More intelligent than grep for understanding code structure. Supports all major languages.',
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The symbol name to find (class, function, interface, type, variable name)',
            },
            path: {
                type: 'string',
                description: 'Directory to search in (defaults to project root)',
            },
            file_pattern: {
                type: 'string',
                description: 'Glob pattern to filter files (e.g., "*.ts", "*.py", "*.rs")',
            },
            include_usages: {
                type: 'boolean',
                description: 'Include usage sites, not just definitions and imports (default: true)',
            },
        },
        required: ['symbol'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: FindSymbolParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return findSymbolImpl(params, workingDirectory);
    },
};
