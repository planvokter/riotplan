/**
 * file_outline tool - Extract structural outline of a source file
 * 
 * Returns classes, functions, interfaces, types, and their signatures
 * WITHOUT the full file content. Token-efficient way to understand
 * a file's public API and structure.
 * 
 * This approximates what an IDE's "outline view" provides.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve, isAbsolute, extname } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface FileOutlineParams {
    path: string;
    /** Include private/internal symbols (default: false) */
    include_private?: boolean;
}

interface OutlineEntry {
    kind: string;       // 'class' | 'function' | 'interface' | 'type' | 'const' | 'method' | 'property' | etc.
    name: string;
    line: number;
    signature?: string; // Full signature line (e.g., "export async function foo(bar: string): Promise<void>")
    parent?: string;    // Parent class/interface name for methods
}

/**
 * Extract outline from TypeScript/JavaScript
 */
function outlineJS(content: string, includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');
    let currentClass: string | undefined;
    let braceDepth = 0;
    let classStartDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        // Track brace depth for class membership
        for (const ch of line) {
            if (ch === '{') braceDepth++;
            if (ch === '}') {
                braceDepth--;
                if (currentClass && braceDepth <= classStartDepth) {
                    currentClass = undefined;
                }
            }
        }

        // Export/top-level declarations
        let match;

        // Classes
        match = trimmed.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)(\s+extends\s+\w+)?(\s+implements\s+[\w,\s]+)?/);
        if (match) {
            currentClass = match[3];
            classStartDepth = braceDepth - 1;
            entries.push({ kind: 'class', name: match[3], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() });
            continue;
        }

        // Interfaces
        match = trimmed.match(/^(export\s+)?interface\s+(\w+)(\s+extends\s+[\w,\s<>]+)?/);
        if (match) {
            entries.push({ kind: 'interface', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() });
            continue;
        }

        // Type aliases
        match = trimmed.match(/^(export\s+)?type\s+(\w+)(\s*<[^>]*>)?\s*=/);
        if (match) {
            entries.push({ kind: 'type', name: match[2], line: lineNum, signature: trimmed.length < 120 ? trimmed : trimmed.slice(0, 120) + '...' });
            continue;
        }

        // Enums
        match = trimmed.match(/^(export\s+)?enum\s+(\w+)/);
        if (match) {
            entries.push({ kind: 'enum', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() });
            continue;
        }

        // Functions (top-level or exported)
        match = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*(\([^)]*\))/);
        if (match && !currentClass) {
            entries.push({ kind: 'function', name: match[3], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() });
            continue;
        }

        // Arrow function exports: export const foo = (args) =>
        match = trimmed.match(/^(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s+)?\(/);
        if (match && !currentClass) {
            entries.push({ kind: 'function', name: match[3], line: lineNum, signature: trimmed.replace(/\{.*$/, '').replace(/=>.*$/, '=>').trim() });
            continue;
        }

        // Exported constants (non-function)
        match = trimmed.match(/^export\s+(const|let|var)\s+(\w+)\s*[=:]/);
        if (match && !currentClass) {
            entries.push({ kind: 'const', name: match[2], line: lineNum, signature: trimmed.length < 120 ? trimmed : trimmed.slice(0, 120) + '...' });
            continue;
        }

        // Class methods (inside a class)
        if (currentClass) {
            match = trimmed.match(/^(public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|abstract\s+)*(\w+)\s*(\([^)]*\))/);
            if (match && match[2] !== 'if' && match[2] !== 'for' && match[2] !== 'while' && match[2] !== 'switch') {
                const isPrivate = trimmed.startsWith('private') || match[2].startsWith('_');
                if (includePrivate || !isPrivate) {
                    entries.push({
                        kind: 'method',
                        name: match[2],
                        line: lineNum,
                        signature: trimmed.replace(/\{.*$/, '').trim(),
                        parent: currentClass,
                    });
                }
            }
        }
    }

    return entries;
}

/**
 * Extract outline from Python
 */
function outlinePython(content: string, includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');
    let currentClass: string | undefined;
    let classIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;
        const indent = line.search(/\S/);

        // Classes
        let match = trimmed.match(/^class\s+(\w+)(\([^)]*\))?/);
        if (match) {
            currentClass = match[1];
            classIndent = indent;
            entries.push({ kind: 'class', name: match[1], line: lineNum, signature: trimmed.replace(/:$/, '').trim() });
            continue;
        }

        // Functions/methods
        match = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);
        if (match) {
            const name = match[2];
            const isPrivate = name.startsWith('_') && !name.startsWith('__');
            if (!includePrivate && isPrivate) continue;

            if (currentClass && indent > classIndent) {
                entries.push({
                    kind: name.startsWith('__') ? 'dunder' : 'method',
                    name,
                    line: lineNum,
                    signature: trimmed.replace(/:$/, '').trim(),
                    parent: currentClass,
                });
            } else {
                currentClass = undefined;
                entries.push({ kind: 'function', name, line: lineNum, signature: trimmed.replace(/:$/, '').trim() });
            }
        }
    }

    return entries;
}

/**
 * Extract outline from Rust
 */
function outlineRust(content: string, includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;
        const isPub = trimmed.startsWith('pub');

        if (!includePrivate && !isPub) continue;

        let match;
        match = trimmed.match(/^(pub\s+)?struct\s+(\w+)/);
        if (match) { entries.push({ kind: 'struct', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^(pub\s+)?enum\s+(\w+)/);
        if (match) { entries.push({ kind: 'enum', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^(pub\s+)?trait\s+(\w+)/);
        if (match) { entries.push({ kind: 'trait', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^(pub\s+)?(async\s+)?fn\s+(\w+)/);
        if (match) { entries.push({ kind: 'function', name: match[3], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^(pub\s+)?type\s+(\w+)/);
        if (match) { entries.push({ kind: 'type', name: match[2], line: lineNum, signature: trimmed.trim() }); continue; }

        match = trimmed.match(/^(pub\s+)?mod\s+(\w+)/);
        if (match) { entries.push({ kind: 'mod', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }
    }

    return entries;
}

/**
 * Extract outline from Java/Kotlin
 */
function outlineJava(content: string, _includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const lineNum = i + 1;

        let match;
        match = trimmed.match(/^(public\s+|private\s+|protected\s+)?(abstract\s+)?(class|interface|enum)\s+(\w+)/);
        if (match) { entries.push({ kind: match[3], name: match[4], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^(public|protected)\s+.*\s+(\w+)\s*\(/);
        if (match) { entries.push({ kind: 'method', name: match[2], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); }
    }

    return entries;
}

/**
 * Extract outline from Go
 */
function outlineGo(content: string, includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const lineNum = i + 1;

        let match;
        match = trimmed.match(/^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(/);
        if (match) {
            const name = match[2];
            const isExported = name[0] === name[0].toUpperCase();
            if (!includePrivate && !isExported) continue;
            entries.push({
                kind: match[1] ? 'method' : 'function',
                name,
                line: lineNum,
                signature: trimmed.replace(/\{.*$/, '').trim(),
                parent: match[1],
            });
            continue;
        }

        match = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
        if (match) {
            const isExported = match[1][0] === match[1][0].toUpperCase();
            if (!includePrivate && !isExported) continue;
            entries.push({ kind: match[2], name: match[1], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() });
        }
    }

    return entries;
}

/**
 * Extract outline from C/C++ headers
 */
function outlineC(content: string, _includePrivate: boolean): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const lineNum = i + 1;

        let match;
        match = trimmed.match(/^(?:class|struct)\s+(\w+)/);
        if (match) { entries.push({ kind: 'struct', name: match[1], line: lineNum, signature: trimmed.replace(/\{.*$/, '').trim() }); continue; }

        match = trimmed.match(/^typedef\s+.*\s+(\w+)\s*;/);
        if (match) { entries.push({ kind: 'typedef', name: match[1], line: lineNum, signature: trimmed }); continue; }

        // Function declarations in headers
        match = trimmed.match(/^(?:extern\s+)?(?:[\w*]+\s+)+(\w+)\s*\([^)]*\)\s*;/);
        if (match) { entries.push({ kind: 'function', name: match[1], line: lineNum, signature: trimmed }); continue; }

        match = trimmed.match(/^#define\s+(\w+)/);
        if (match) { entries.push({ kind: 'macro', name: match[1], line: lineNum, signature: trimmed.length < 120 ? trimmed : trimmed.slice(0, 120) + '...' }); }
    }

    return entries;
}

/**
 * Get the outline of a file
 */
export async function fileOutlineImpl(
    params: FileOutlineParams,
    workingDirectory: string
): Promise<string> {
    const filePath = isAbsolute(params.path)
        ? params.path
        : resolve(workingDirectory, params.path);

    // Check if path is a directory
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
        return `Error: "${params.path}" is a directory, not a file. Use list_files to explore directories, or provide a path to a specific source file.`;
    }

    const content = await readFile(filePath, 'utf-8');
    const ext = extname(filePath);
    const includePrivate = params.include_private ?? false;

    let entries: OutlineEntry[];

    switch (ext) {
        case '.ts': case '.tsx': case '.js': case '.jsx': case '.mjs': case '.cjs':
            entries = outlineJS(content, includePrivate);
            break;
        case '.py':
            entries = outlinePython(content, includePrivate);
            break;
        case '.rs':
            entries = outlineRust(content, includePrivate);
            break;
        case '.java': case '.kt':
            entries = outlineJava(content, includePrivate);
            break;
        case '.go':
            entries = outlineGo(content, includePrivate);
            break;
        case '.h': case '.hpp': case '.hxx': case '.c': case '.cpp':
            entries = outlineC(content, includePrivate);
            break;
        default:
            return `Unsupported file type: ${ext}. Supported: .ts, .js, .py, .rs, .java, .kt, .go, .h, .hpp, .c, .cpp`;
    }

    if (entries.length === 0) {
        return 'No symbols found in file.';
    }

    // Format output grouped by kind
    const lines: string[] = [`# ${params.path} (${entries.length} symbols)\n`];
    
    // Group by parent (for class methods)
    const topLevel = entries.filter(e => !e.parent);
    const byParent = new Map<string, OutlineEntry[]>();
    for (const e of entries.filter(e => e.parent)) {
        if (!byParent.has(e.parent!)) byParent.set(e.parent!, []);
        byParent.get(e.parent!)!.push(e);
    }

    for (const entry of topLevel) {
        lines.push(`L${entry.line}: [${entry.kind}] ${entry.signature || entry.name}`);
        
        // Show methods under their class
        const methods = byParent.get(entry.name);
        if (methods) {
            for (const m of methods) {
                lines.push(`  L${m.line}: [${m.kind}] ${m.signature || m.name}`);
            }
        }
    }

    return lines.join('\n');
}

export const fileOutlineTool: Tool = {
    name: 'file_outline',
    description: 'Get the structural outline of a source file: classes, functions, interfaces, types, and their signatures. Much more token-efficient than reading the whole file when you just need to understand a file\'s structure and public API. Supports TypeScript, JavaScript, Python, Rust, Java, Kotlin, Go, C, and C++.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the source file (absolute or relative to working directory)',
            },
            include_private: {
                type: 'boolean',
                description: 'Include private/internal symbols (default: false, shows only public API)',
            },
        },
        required: ['path'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: FileOutlineParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return fileOutlineImpl(params, workingDirectory);
    },
};
