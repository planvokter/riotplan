import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
    StepCompletionResult,
    StepCompletionStatus,
    AcceptanceCriterion,
    CompletionReport,
} from "./types.js";

/**
 * Check completion of plan execution
 */
export async function checkCompletion(planPath: string): Promise<CompletionReport> {
    // Load STATUS.md
    const statusMap = await loadStatusMap(planPath);
    
    // Load step files and extract acceptance criteria
    const stepResults = await loadStepResults(planPath, statusMap);
    
    // Build report
    return buildCompletionReport(stepResults);
}

/**
 * Load step status from STATUS.md
 */
async function loadStatusMap(planPath: string): Promise<Map<number, string>> {
    const statusMap = new Map<number, string>();
    
    try {
        const statusPath = join(planPath, "STATUS.md");
        const content = await readFile(statusPath, "utf-8");
        
        // Parse the step progress table
        // Format: | 01 | Step Name | ✅ Completed | ... |
        // Use line-by-line parsing to avoid polynomial regex
        const lines = content.split('\n');
        let inTable = false;
        
        for (const line of lines) {
            // Look for table header
            if (/\|\s*Step\s*\|\s*Name\s*\|\s*Status/i.test(line)) {
                inTable = true;
                continue;
            }
            
            // Stop at section headers or double newlines
            if (inTable && (/^##/.test(line) || line.trim() === '')) {
                break;
            }
            
            // Parse table rows
            if (inTable && line.includes('|')) {
                const match = line.match(/\|\s*(\d+)\s*\|[^|]+\|\s*([^|]+)\|/);
                if (match) {
                    const stepNum = parseInt(match[1]);
                    const status = match[2].trim();
                    statusMap.set(stepNum, status);
                }
            }
        }
    } catch {
        // STATUS.md doesn't exist
    }
    
    return statusMap;
}

/**
 * Load step files and extract acceptance criteria
 */
async function loadStepResults(
    planPath: string,
    statusMap: Map<number, string>
): Promise<StepCompletionResult[]> {
    const results: StepCompletionResult[] = [];
    const planDir = join(planPath, "plan");
    
    try {
        const files = await readdir(planDir);
        const stepFiles = files.filter(f => /^\d{2}-/.test(f) && f.endsWith(".md")).sort();
        
        for (const file of stepFiles) {
            const stepNum = parseInt(file.slice(0, 2));
            const content = await readFile(join(planDir, file), "utf-8");
            
            const result = analyzeStep(stepNum, content, statusMap.get(stepNum) || "⬜ Pending");
            results.push(result);
        }
    } catch {
        // Plan directory doesn't exist
    }
    
    return results;
}

/**
 * Analyze a single step for completion
 */
function analyzeStep(
    stepNum: number,
    content: string,
    markedStatus: string
): StepCompletionResult {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const stepTitle = titleMatch ? titleMatch[1] : `Step ${stepNum}`;
    
    const criteria = extractAcceptanceCriteria(content, stepNum);
    
    const status = determineCompletionStatus(criteria, markedStatus);
    
    return {
        stepNumber: stepNum,
        stepTitle,
        status,
        acceptanceCriteria: criteria,
        markedStatus,
    };
}

/**
 * Extract acceptance criteria from step content
 */
function extractAcceptanceCriteria(content: string, stepNum: number): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];
    
    // Find Acceptance Criteria section
    // Use line-by-line parsing to avoid polynomial regex
    const lines = content.split('\n');
    const sectionLines: string[] = [];
    let inSection = false;
    
    for (const line of lines) {
        if (/^##\s*Acceptance\s+Criteria$/i.test(line)) {
            inSection = true;
            continue;
        }
        if (inSection && /^##/.test(line)) {
            break;
        }
        if (inSection) {
            sectionLines.push(line);
        }
    }
    
    if (sectionLines.length === 0) {
        return criteria;
    }
    
    const sectionContent = sectionLines.join('\n');
    
    const checkboxRegex = /^[-*]\s*\[([x ])\]\s*(.+)$/gim;
    let match;
    
    while ((match = checkboxRegex.exec(sectionContent)) !== null) {
        criteria.push({
            text: match[2].trim(),
            checked: match[1].toLowerCase() === "x",
            stepNumber: stepNum,
        });
    }
    
    return criteria;
}

/**
 * Determine actual completion status based on criteria and marked status
 */
function determineCompletionStatus(
    criteria: AcceptanceCriterion[],
    markedStatus: string
): StepCompletionStatus {
    const isMarkedComplete = markedStatus.includes("✅") || markedStatus.toLowerCase().includes("complete");
    const isMarkedPending = markedStatus.includes("⬜") || markedStatus.toLowerCase().includes("pending");
    const isMarkedInProgress = markedStatus.includes("🔄") || markedStatus.toLowerCase().includes("progress");
    const isMarkedSkipped = markedStatus.includes("⏭️") || markedStatus.toLowerCase().includes("skip");
    
    if (isMarkedSkipped) {
        return "skipped";
    }
    
    if (criteria.length === 0) {
        if (isMarkedComplete) return "complete";
        if (isMarkedPending) return "pending";
        return "partial";
    }
    
    const checkedCount = criteria.filter(c => c.checked).length;
    const allChecked = checkedCount === criteria.length;
    const noneChecked = checkedCount === 0;
    
    if (isMarkedComplete) {
        if (allChecked) return "complete";
        if (noneChecked) return "incomplete";
        return "partial";
    }
    
    if (isMarkedInProgress) {
        return "partial";
    }
    
    return "pending";
}

/**
 * Build the completion report
 */
function buildCompletionReport(results: StepCompletionResult[]): CompletionReport {
    const complete = results.filter(r => r.status === "complete");
    const partial = results.filter(r => r.status === "partial");
    const incomplete = results.filter(r => r.status === "incomplete");
    const pending = results.filter(r => r.status === "pending" || r.status === "skipped");
    
    const totalSteps = results.length;
    const completedSteps = complete.length + partial.length * 0.5;
    const completionScore = totalSteps > 0 
        ? Math.round((completedSteps / totalSteps) * 100) 
        : 100;
    
    const outstandingItems: string[] = [];
    
    for (const result of [...incomplete, ...partial]) {
        const unchecked = result.acceptanceCriteria.filter(c => !c.checked);
        for (const criterion of unchecked) {
            outstandingItems.push(`Step ${result.stepNumber}: ${criterion.text}`);
        }
    }
    
    return {
        totalSteps,
        complete,
        partial,
        incomplete,
        pending,
        completionScore,
        outstandingItems,
    };
}
