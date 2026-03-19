/**
 * Retrospective Reference Reader
 * 
 * Loads retrospective files from completed plans and wraps them with context
 * for inclusion in idea exploration. This enables the outer learning loop where
 * past plan execution informs future plan creation.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readPlanDoc } from '../artifacts/operations.js';

/**
 * Load a retrospective file and wrap it with contextual framing
 * 
 * @param retrospectivePath - Path to the plan directory or .plan file
 * @param reason - User's explanation of why this retrospective is relevant
 * @returns Wrapped retrospective content ready for context inclusion
 * @throws Error if retrospective file doesn't exist
 */
export async function loadRetrospectiveAsContext(
    retrospectivePath: string,
    reason: string
): Promise<string> {
    const doc = await readPlanDoc(retrospectivePath, 'other', 'RETROSPECTIVE.md');

    if (!doc) {
        if (!retrospectivePath.endsWith('.plan')) {
            const retroFile = join(retrospectivePath, 'retrospective.md');
            if (existsSync(retroFile)) {
                const content = await readFile(retroFile, 'utf-8');
                return formatRetrospectiveContext(retrospectivePath, reason, content);
            }
        }
        throw new Error(
            `Retrospective not found at ${retrospectivePath}. ` +
            `Ensure the plan has been completed and retrospective generated.`
        );
    }

    return formatRetrospectiveContext(retrospectivePath, reason, doc.content);
}

/**
 * Format retrospective content with contextual wrapping
 * 
 * @param planPath - Path to the source plan
 * @param reason - Why this retrospective is relevant
 * @param content - Raw retrospective content
 * @returns Formatted context string
 */
function formatRetrospectiveContext(
    planPath: string,
    reason: string,
    content: string
): string {
    return `## Referenced Retrospective

**Source**: ${planPath}
**Why this is relevant**: ${reason}

---

${content}

---

**Consider the lessons above when exploring this new idea:**
- What patterns from that experience apply here?
- What mistakes should be avoided?
- What assumptions were wrong that might be wrong again?
- What worked well that could be reused?
`;
}

/**
 * Check if a retrospective exists for a given plan
 * 
 * @param planPath - Path to the plan directory or .plan file
 * @returns True if retrospective exists
 */
export async function retrospectiveExists(planPath: string): Promise<boolean> {
    if (planPath.endsWith('.plan')) {
        const doc = await readPlanDoc(planPath, 'other', 'RETROSPECTIVE.md');
        return doc !== null;
    }
    return existsSync(join(planPath, 'retrospective.md')) ||
           existsSync(join(planPath, 'RETROSPECTIVE.md'));
}

/**
 * Load multiple retrospectives and combine them
 * 
 * @param references - Array of {path, reason} objects
 * @returns Combined wrapped content
 */
export async function loadMultipleRetrospectives(
    references: Array<{ path: string; reason: string }>
): Promise<string> {
    const contexts = await Promise.all(
        references.map(ref => loadRetrospectiveAsContext(ref.path, ref.reason))
    );
    
    return contexts.join('\n\n---\n\n');
}
