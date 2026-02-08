/**
 * Token Estimation and Budget Management
 * 
 * Utilities for estimating token counts and managing prompt budgets
 */

export interface TokenBudget {
    maxTokens: number;
    evidenceFullThreshold: number;  // Evidence under this size (bytes) included in full
    evidenceSummaryThreshold: number;  // Evidence over this summarized
    historyFullCount: number;  // Number of history events to include when under budget
    historyAbbreviatedCount: number;  // Number when over budget
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
    maxTokens: 40000,  // Conservative default for most models
    evidenceFullThreshold: 2048,  // 2KB
    evidenceSummaryThreshold: 20480,  // 20KB
    historyFullCount: 15,
    historyAbbreviatedCount: 5,
};

export interface TieringDecision {
    totalEstimatedTokens: number;
    budgetExceeded: boolean;
    evidenceTiered: {
        full: string[];
        summarized: string[];
        listOnly: string[];
    };
    historyAbbreviated: boolean;
    warnings: string[];
}

/**
 * Estimate token count from text
 * Uses character count / 4 as a reasonable approximation
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Truncate text to a line count with ellipsis
 */
export function truncateToLines(text: string, lineCount: number): string {
    const lines = text.split('\n');
    if (lines.length <= lineCount) {
        return text;
    }
    return lines.slice(0, lineCount).join('\n') + '\n\n... [truncated, see full file]';
}

/**
 * Calculate tiering decisions based on artifact sizes and budget
 */
export function calculateTiering(
    constraints: string[],
    selectedApproach: { name: string; description: string; reasoning: string } | null,
    evidence: { name: string; content: string; size: number }[],
    historyEventCount: number,
    budget: TokenBudget = DEFAULT_TOKEN_BUDGET
): TieringDecision {
    const decision: TieringDecision = {
        totalEstimatedTokens: 0,
        budgetExceeded: false,
        evidenceTiered: {
            full: [],
            summarized: [],
            listOnly: [],
        },
        historyAbbreviated: false,
        warnings: [],
    };

    // Calculate base tokens (always included)
    let baseTokens = 0;
    
    // Constraints (always full)
    for (const constraint of constraints) {
        baseTokens += estimateTokens(constraint);
    }
    
    // Selected approach (always full)
    if (selectedApproach) {
        baseTokens += estimateTokens(selectedApproach.name);
        baseTokens += estimateTokens(selectedApproach.description);
        baseTokens += estimateTokens(selectedApproach.reasoning);
    }
    
    // System prompt and structure overhead (rough estimate)
    baseTokens += 2000;
    
    decision.totalEstimatedTokens = baseTokens;

    // Calculate evidence tokens and tier
    let evidenceTokens = 0;
    for (const ev of evidence) {
        const fullTokens = estimateTokens(ev.content);
        
        if (ev.size < budget.evidenceFullThreshold) {
            // Tier 1: Include full
            decision.evidenceTiered.full.push(ev.name);
            evidenceTokens += fullTokens;
        } else if (ev.size < budget.evidenceSummaryThreshold) {
            // Tier 2: Summarize (first 50 lines)
            const summarized = truncateToLines(ev.content, 50);
            decision.evidenceTiered.summarized.push(ev.name);
            evidenceTokens += estimateTokens(summarized);
        } else {
            // Tier 3: List only (first 5 lines)
            const listOnly = truncateToLines(ev.content, 5);
            decision.evidenceTiered.listOnly.push(ev.name);
            evidenceTokens += estimateTokens(listOnly);
            decision.warnings.push(`Evidence file "${ev.name}" is very large (${Math.round(ev.size / 1024)}KB), showing first 5 lines only`);
        }
    }
    
    decision.totalEstimatedTokens += evidenceTokens;

    // Calculate history tokens
    const avgEventTokens = 50;  // Rough estimate per event
    const historyTokens = historyEventCount * avgEventTokens;
    decision.totalEstimatedTokens += historyTokens;

    // Check if we exceeded budget
    if (decision.totalEstimatedTokens > budget.maxTokens) {
        decision.budgetExceeded = true;
        
        // Abbreviate history if needed
        if (historyEventCount > budget.historyAbbreviatedCount) {
            decision.historyAbbreviated = true;
            const savedTokens = (historyEventCount - budget.historyAbbreviatedCount) * avgEventTokens;
            decision.totalEstimatedTokens -= savedTokens;
            decision.warnings.push(`History abbreviated to ${budget.historyAbbreviatedCount} most recent events (was ${historyEventCount})`);
        }
    }

    // Add summary warnings
    if (decision.evidenceTiered.summarized.length > 0) {
        decision.warnings.push(`${decision.evidenceTiered.summarized.length} evidence file(s) summarized to manage token budget`);
    }

    return decision;
}

/**
 * Apply tiering decisions to evidence array
 */
export function applyEvidenceTiering(
    evidence: { name: string; content: string; size: number }[],
    decision: TieringDecision
): { name: string; content: string; size: number; tiered?: 'summarized' | 'listOnly' }[] {
    return evidence.map(ev => {
        if (decision.evidenceTiered.summarized.includes(ev.name)) {
            return {
                ...ev,
                content: truncateToLines(ev.content, 50),
                tiered: 'summarized' as const,
            };
        } else if (decision.evidenceTiered.listOnly.includes(ev.name)) {
            return {
                ...ev,
                content: truncateToLines(ev.content, 5),
                tiered: 'listOnly' as const,
            };
        }
        return ev;
    });
}
