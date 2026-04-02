import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { 
    VerificationCriterion, 
    CriterionResult, 
    CoverageReport,
    CriteriaStatus 
} from "./types.js";
import { PRIORITY_WEIGHTS } from "./constants.js";
import { parseCriteria } from "./criteria-parser.js";

export interface CoverageOptions {
    /** Minimum keyword match score to consider "covered" */
    coverageThreshold?: number;
    /** Minimum keyword match score to consider "partial" */
    partialThreshold?: number;
}

const DEFAULT_OPTIONS: Required<CoverageOptions> = {
    coverageThreshold: 0.6,
    partialThreshold: 0.3,
};

/**
 * Check coverage of analysis criteria in plan steps
 */
export async function checkCoverage(
    planPath: string,
    options: CoverageOptions = {}
): Promise<CoverageReport> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Parse criteria from analysis
    const { criteria, parseErrors } = await parseCriteria(planPath);
    
    if (criteria.length === 0) {
        return createEmptyReport(parseErrors);
    }
    
    // Load all step files
    const steps = await loadStepFiles(planPath);
    
    // Check each criterion against steps
    const results: CriterionResult[] = [];
    
    for (const criterion of criteria) {
        const result = checkCriterionCoverage(criterion, steps, opts);
        results.push(result);
    }
    
    // Build report
    return buildCoverageReport(results);
}

/**
 * Load all step file contents
 */
async function loadStepFiles(planPath: string): Promise<Map<number, string>> {
    const steps = new Map<number, string>();
    const planDir = join(planPath, "plan");
    
    try {
        const files = await readdir(planDir);
        const stepFiles = files.filter(f => /^\d{2}-/.test(f) && f.endsWith(".md"));
        
        for (const file of stepFiles) {
            const stepNum = parseInt(file.slice(0, 2));
            const content = await readFile(join(planDir, file), "utf-8");
            steps.set(stepNum, content);
        }
    } catch {
        // Plan directory doesn't exist or is empty
    }
    
    return steps;
}

/**
 * Check if a single criterion is covered by any step
 */
function checkCriterionCoverage(
    criterion: VerificationCriterion,
    steps: Map<number, string>,
    options: Required<CoverageOptions>
): CriterionResult {
    const keywords = extractKeywords(criterion.text);
    
    const matchedSteps: number[] = [];
    let bestScore = 0;
    
    for (const [stepNum, content] of steps) {
        const score = calculateMatchScore(keywords, content);
        if (score > bestScore) {
            bestScore = score;
        }
        if (score >= options.partialThreshold) {
            matchedSteps.push(stepNum);
        }
    }
    
    let status: CriteriaStatus;
    if (bestScore >= options.coverageThreshold) {
        status = "covered";
    } else if (bestScore >= options.partialThreshold) {
        status = "partial";
    } else {
        status = "missing";
    }
    
    return {
        criterion,
        status,
        matchedSteps,
        notes: matchedSteps.length > 0 
            ? `Best match in step(s): ${matchedSteps.join(", ")}` 
            : undefined,
    };
}

/**
 * Extract significant keywords from text
 */
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "shall",
        "can", "need", "to", "of", "in", "for", "on", "with", "at",
        "by", "from", "as", "or", "and", "but", "if", "then", "so",
        "that", "this", "it", "its", "all", "any", "each", "every",
    ]);
    
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate match score between keywords and content
 */
function calculateMatchScore(keywords: string[], content: string): number {
    if (keywords.length === 0) return 0;
    
    const contentLower = content.toLowerCase();
    let matches = 0;
    
    for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
            matches++;
        }
    }
    
    return matches / keywords.length;
}

/**
 * Build the full coverage report
 */
function buildCoverageReport(results: CriterionResult[]): CoverageReport {
    const covered = results.filter(r => r.status === "covered");
    const partial = results.filter(r => r.status === "partial");
    const missing = results.filter(r => r.status === "missing");
    
    const byPriority = {
        must: calculatePriorityStats(results, "must"),
        should: calculatePriorityStats(results, "should"),
        could: calculatePriorityStats(results, "could"),
    };
    
    const coverageScore = calculateWeightedScore(byPriority);
    const questions = generateVerificationQuestions(partial, missing);
    
    return {
        totalCriteria: results.length,
        covered,
        partial,
        missing,
        byPriority,
        coverageScore,
        questions,
    };
}

function calculatePriorityStats(
    results: CriterionResult[],
    priority: string
): { total: number; covered: number; partial: number; missing: number } {
    const forPriority = results.filter(r => r.criterion.priority === priority);
    return {
        total: forPriority.length,
        covered: forPriority.filter(r => r.status === "covered").length,
        partial: forPriority.filter(r => r.status === "partial").length,
        missing: forPriority.filter(r => r.status === "missing").length,
    };
}

function calculateWeightedScore(byPriority: CoverageReport["byPriority"]): number {
    let totalWeight = 0;
    let weightedCovered = 0;
    
    for (const [priority, stats] of Object.entries(byPriority)) {
        const weight = PRIORITY_WEIGHTS[priority as keyof typeof PRIORITY_WEIGHTS];
        totalWeight += stats.total * weight;
        weightedCovered += (stats.covered + stats.partial * 0.5) * weight;
    }
    
    if (totalWeight === 0) return 100;
    return Math.round((weightedCovered / totalWeight) * 100);
}

function generateVerificationQuestions(
    partial: CriterionResult[],
    missing: CriterionResult[]
): string[] {
    const questions: string[] = [];
    
    for (const result of missing.slice(0, 3)) {
        questions.push(`Where is "${result.criterion.text}" addressed in the plan?`);
    }
    
    for (const result of partial.slice(0, 2)) {
        questions.push(
            `Is "${result.criterion.text}" fully covered in step(s) ${result.matchedSteps.join(", ")}?`
        );
    }
    
    return questions;
}

function createEmptyReport(errors: string[]): CoverageReport {
    return {
        totalCriteria: 0,
        covered: [],
        partial: [],
        missing: [],
        byPriority: {
            must: { total: 0, covered: 0, partial: 0, missing: 0 },
            should: { total: 0, covered: 0, partial: 0, missing: 0 },
            could: { total: 0, covered: 0, partial: 0, missing: 0 },
        },
        coverageScore: 100,
        questions: errors,
    };
}
