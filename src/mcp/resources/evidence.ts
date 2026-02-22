/**
 * Evidence Resource Handler
 * 
 * Provides access to evidence/ directory
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function readEvidenceListResource(planPath: string): Promise<any> {
    const evidenceDir = join(planPath, 'evidence');
    
    try {
        const files = await readdir(evidenceDir);
        const evidenceFiles = await Promise.all(
            files.map(async (file) => {
                const filePath = join(evidenceDir, file);
                const stats = await stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                };
            })
        );
        
        return {
            evidence: evidenceFiles,
            count: evidenceFiles.length,
            type: 'evidence_list',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                evidence: [],
                count: 0,
                type: 'evidence_list',
                note: 'No evidence directory found',
            };
        }
        throw error;
    }
}

export async function readEvidenceResource(planPath: string, evidenceFile: string): Promise<any> {
    const evidencePath = join(planPath, 'evidence', evidenceFile);
    
    try {
        const content = await readFile(evidencePath, 'utf-8');
        const stats = await stat(evidencePath);
        
        return {
            file: evidenceFile,
            content,
            size: stats.size,
            modified: stats.mtime,
            type: 'evidence',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Evidence file not found: ${evidenceFile}`);
        }
        throw error;
    }
}
