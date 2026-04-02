/**
 * STATUS.md Parser Module
 *
 * Parses STATUS.md files into structured PlanState and StatusDocument objects.
 * Handles various format variations and provides warnings for parsing issues.
 */
import type { PlanState, StatusDocument, PlanStep } from "../types.js";
/**
 * Options for parsing STATUS.md
 */
export interface ParseStatusOptions {
    /** Steps to cross-reference for status updates */
    steps?: PlanStep[];
}
/**
 * Result of parsing STATUS.md
 */
export interface ParseStatusResult {
    /** Parsed status document */
    document: StatusDocument;
    /** Derived plan state */
    state: PlanState;
    /** Parsing warnings */
    warnings: string[];
}
/**
 * Parse STATUS.md content into structured data
 *
 * @param content - The STATUS.md file content
 * @param options - Parsing options
 * @returns Parsed document, state, and any warnings
 *
 * @example
 * ```typescript
 * const content = await readFile('STATUS.md', 'utf-8');
 * const result = parseStatus(content);
 * console.log(result.state.progress); // 40
 * console.log(result.document.stepProgress.length); // 5
 * ```
 */
export declare function parseStatus(content: string, options?: ParseStatusOptions): ParseStatusResult;
//# sourceMappingURL=parser.d.ts.map