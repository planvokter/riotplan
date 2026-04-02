import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { VerificationCriterion, CriteriaPriority } from "./types.js";
import { CRITERIA_PATTERNS } from "./constants.js";

export interface ParsedCriteria {
    criteria: VerificationCriterion[];
    source: string;
    parseErrors: string[];
}

/**
 * Parse verification criteria from a plan's analysis
 */
export async function parseCriteria(planPath: string): Promise<ParsedCriteria> {
    const reqPath = join(planPath, "analysis", "REQUIREMENTS.md");
    
    try {
        const content = await readFile(reqPath, "utf-8");
        return parseCriteriaFromContent(content, reqPath);
    } catch (error) {
        return {
            criteria: [],
            source: reqPath,
            parseErrors: [`Could not read ${reqPath}: ${(error as Error).message}`],
        };
    }
}

/**
 * Parse criteria from markdown content
 */
export function parseCriteriaFromContent(
    content: string,
    source: string
): ParsedCriteria {
    const criteria: VerificationCriterion[] = [];
    const parseErrors: string[] = [];
    
    // Find the Verification Criteria section
    const sectionMatch = content.match(CRITERIA_PATTERNS.verificationSection);
    if (!sectionMatch) {
        return {
            criteria: [],
            source,
            parseErrors: ["No 'Verification Criteria' section found"],
        };
    }
    
    // Extract content after the section header until next ## header
    const sectionStart = sectionMatch.index! + sectionMatch[0].length;
    const nextSectionMatch = content.slice(sectionStart).match(/^##\s+[^#]/m);
    const sectionEnd = nextSectionMatch 
        ? sectionStart + nextSectionMatch.index! 
        : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd);
    
    // Split into priority sections
    const lines = sectionContent.split("\n");
    let currentPriority: CriteriaPriority = "should";  // default
    let lineNumber = content.slice(0, sectionStart).split("\n").length;
    
    for (const line of lines) {
        lineNumber++;
        
        // Check for priority headers
        if (CRITERIA_PATTERNS.mustHaveHeader.test(line)) {
            currentPriority = "must";
            continue;
        }
        if (CRITERIA_PATTERNS.shouldHaveHeader.test(line)) {
            currentPriority = "should";
            continue;
        }
        if (CRITERIA_PATTERNS.couldHaveHeader.test(line)) {
            currentPriority = "could";
            continue;
        }
        
        // Check for checkbox items
        const checkboxMatch = line.match(/^[-*]\s*\[([x ])\]\s*(.+)$/i);
        if (checkboxMatch) {
            const text = checkboxMatch[2].trim();
            const id = generateCriterionId(text, criteria.length);
            
            criteria.push({
                id,
                text,
                priority: currentPriority,
                source,
                lineNumber,
            });
        }
    }
    
    if (criteria.length === 0) {
        parseErrors.push("No checkbox criteria found in Verification Criteria section");
    }
    
    return { criteria, source, parseErrors };
}

/**
 * Generate a unique ID for a criterion
 */
function generateCriterionId(text: string, index: number): string {
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
    return `${String(index + 1).padStart(3, "0")}-${slug}`;
}

/**
 * Get criteria summary statistics
 */
export function getCriteriaSummary(criteria: VerificationCriterion[]): {
    total: number;
    must: number;
    should: number;
    could: number;
} {
    return {
        total: criteria.length,
        must: criteria.filter(c => c.priority === "must").length,
        should: criteria.filter(c => c.priority === "should").length,
        could: criteria.filter(c => c.priority === "could").length,
    };
}
