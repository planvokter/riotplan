/**
 * Retrospective Reference Reader
 *
 * Loads retrospective files from completed plans and wraps them with context
 * for inclusion in idea exploration. This enables the outer learning loop where
 * past plan execution informs future plan creation.
 */
/**
 * Load a retrospective file and wrap it with contextual framing
 *
 * @param retrospectivePath - Path to the plan directory or .plan file
 * @param reason - User's explanation of why this retrospective is relevant
 * @returns Wrapped retrospective content ready for context inclusion
 * @throws Error if retrospective file doesn't exist
 */
export declare function loadRetrospectiveAsContext(retrospectivePath: string, reason: string): Promise<string>;
/**
 * Check if a retrospective exists for a given plan
 *
 * @param planPath - Path to the plan directory or .plan file
 * @returns True if retrospective exists
 */
export declare function retrospectiveExists(planPath: string): Promise<boolean>;
/**
 * Load multiple retrospectives and combine them
 *
 * @param references - Array of {path, reason} objects
 * @returns Combined wrapped content
 */
export declare function loadMultipleRetrospectives(references: Array<{
    path: string;
    reason: string;
}>): Promise<string>;
//# sourceMappingURL=reference.d.ts.map