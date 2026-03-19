/**
 * Temporary compatibility contract while splitting
 * into core + mcp-http + format package boundaries.
 */
export const LEGACY_COMPAT_EXPORTS = [
    "loadPlan",
    "createPlan",
    "validatePlan",
    "startStep",
    "completeStep",
    "parseStatus",
    "generateStatus",
    "createProgram",
    "startServer",
    "parseCriteria",
    "checkCoverage",
    "checkCompletion",
] as const;

export type LegacyCompatExport = (typeof LEGACY_COMPAT_EXPORTS)[number];
