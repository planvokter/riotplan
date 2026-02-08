/**
 * Plan Validation
 *
 * Validates plan structure, step numbering, dependencies, and content.
 * Provides actionable error messages and identifies fixable issues.
 */

import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plan, PlanStep } from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";

// ===== TYPES =====

export interface ValidationResult {
    /** Is the plan valid? */
    valid: boolean;

    /** Errors (must fix) */
    errors: ValidationError[];

    /** Warnings (should fix) */
    warnings: ValidationWarning[];

    /** Info (observations) */
    info: ValidationInfo[];

    /** Auto-fixable issues */
    fixable: FixableIssue[];
}

export interface ValidationError {
    code: string;
    message: string;
    path?: string;
    step?: number;
}

export interface ValidationWarning {
    code: string;
    message: string;
    path?: string;
    step?: number;
}

export interface ValidationInfo {
    code: string;
    message: string;
}

export interface FixableIssue {
    code: string;
    description: string;
    fix: () => Promise<void>;
}

export interface ValidateOptions {
    /** Check step content */
    validateContent?: boolean;

    /** Check dependencies */
    validateDependencies?: boolean;

    /** Check STATUS.md consistency */
    validateStatus?: boolean;

    /** Strict mode (warnings become errors) */
    strict?: boolean;
}

// ===== STRUCTURE VALIDATION =====

/**
 * Validate plan directory structure
 */
async function validateStructure(planPath: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
}> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check directory exists
    try {
        await access(planPath);
    } catch {
        errors.push({
            code: "DIR_NOT_FOUND",
            message: `Plan directory not found: ${planPath}`,
            path: planPath,
        });
        return { errors, warnings };
    }

    // Check for SUMMARY.md
    const summaryPath = join(planPath, PLAN_CONVENTIONS.standardFiles.summary);
    try {
        await access(summaryPath);
    } catch {
        warnings.push({
            code: "MISSING_SUMMARY",
            message: "SUMMARY.md not found",
            path: summaryPath,
        });
    }

    // Check for STATUS.md
    const statusPath = join(planPath, PLAN_CONVENTIONS.standardFiles.status);
    try {
        await access(statusPath);
    } catch {
        warnings.push({
            code: "MISSING_STATUS",
            message: "STATUS.md not found",
            path: statusPath,
        });
    }

    // Check for EXECUTION_PLAN.md
    const execPath = join(
        planPath,
        PLAN_CONVENTIONS.standardFiles.executionPlan
    );
    try {
        await access(execPath);
    } catch {
        warnings.push({
            code: "MISSING_EXEC_PLAN",
            message: "EXECUTION_PLAN.md not found",
            path: execPath,
        });
    }

    // Check for plan/ directory or step files
    const planDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    try {
        await access(planDir);
        const files = await readdir(planDir);
        const stepFiles = files.filter((f) =>
            PLAN_CONVENTIONS.stepPattern.test(f)
        );
        if (stepFiles.length === 0) {
            warnings.push({
                code: "NO_STEPS",
                message: "No step files found in plan/ directory",
            });
        }
    } catch {
        // Plan directory doesn't exist; check root for step files
        try {
            const rootFiles = await readdir(planPath);
            const stepFiles = rootFiles.filter((f) =>
                PLAN_CONVENTIONS.stepPattern.test(f)
            );
            if (stepFiles.length === 0) {
                warnings.push({
                    code: "NO_STEPS",
                    message: "No step files found",
                });
            }
        } catch {
            warnings.push({
                code: "NO_STEPS",
                message: "Unable to read plan directory for step files",
            });
        }
    }

    return { errors, warnings };
}

// ===== STEP NUMBERING VALIDATION =====

/**
 * Validate step file numbering
 */
async function validateStepNumbering(planPath: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
    fixable: FixableIssue[];
}> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const fixable: FixableIssue[] = [];

    // Get step files
    const planDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    let stepFiles: string[] = [];
    let stepDir = planDir;

    try {
        const files = await readdir(planDir);
        stepFiles = files.filter((f) => PLAN_CONVENTIONS.stepPattern.test(f));
    } catch {
        // Plan dir doesn't exist; check root
        try {
            const files = await readdir(planPath);
            stepFiles = files.filter((f) =>
                PLAN_CONVENTIONS.stepPattern.test(f)
            );
            stepDir = planPath;
        } catch {
            return { errors, warnings, fixable };
        }
    }

    if (stepFiles.length === 0) return { errors, warnings, fixable };

    // Extract numbers
    const numbers: number[] = [];
    for (const file of stepFiles) {
        const match = file.match(PLAN_CONVENTIONS.stepPattern);
        if (match) {
            numbers.push(parseInt(match[1]));
        }
    }

    numbers.sort((a, b) => a - b);

    // Check for gaps
    for (let i = 0; i < numbers.length; i++) {
        const expected = i + 1;
        if (numbers[i] !== expected) {
            if (numbers[i] > expected) {
                warnings.push({
                    code: "STEP_GAP",
                    message: `Gap in step numbering: expected ${expected}, found ${numbers[i]}`,
                    step: numbers[i],
                });

                // Add fixable (placeholder - actual fix would require more context)
                const gapPosition = expected;
                fixable.push({
                    code: "FIX_STEP_GAP",
                    description: `Renumber steps to close gap at ${gapPosition}`,
                    fix: async () => {
                        // This would need to be implemented with renumberSteps
                        // For now, this is a placeholder that does nothing
                        void stepDir; // Acknowledge the variable
                        void gapPosition;
                    },
                });
            }
        }
    }

    // Check for duplicates
    const seen = new Set<number>();
    for (const num of numbers) {
        if (seen.has(num)) {
            errors.push({
                code: "DUPLICATE_STEP",
                message: `Duplicate step number: ${num}`,
                step: num,
            });
        }
        seen.add(num);
    }

    // Check doesn't start at 0
    if (numbers[0] === 0) {
        warnings.push({
            code: "STEP_ZERO",
            message: "Step numbering should start at 01, not 00",
        });
    }

    return { errors, warnings, fixable };
}

// ===== CONTENT VALIDATION =====

/**
 * Validate step file content
 */
async function validateStepContent(step: PlanStep): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
}> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
        const content = await readFile(step.filePath, "utf-8");

        // Check for title
        if (!content.match(/^#\s+/m)) {
            warnings.push({
                code: "MISSING_TITLE",
                message: `Step ${step.number} missing title heading`,
                step: step.number,
                path: step.filePath,
            });
        }

        // Check for objective section
        if (!content.match(/##\s+Objective/i)) {
            warnings.push({
                code: "MISSING_OBJECTIVE",
                message: `Step ${step.number} missing Objective section`,
                step: step.number,
            });
        }

        // Check for acceptance criteria
        if (!content.match(/##\s+Acceptance Criteria/i)) {
            warnings.push({
                code: "MISSING_ACCEPTANCE",
                message: `Step ${step.number} missing Acceptance Criteria section`,
                step: step.number,
            });
        }

        // Check step number in title matches filename
        const titleMatch = content.match(/^#\s+Step\s+(\d+)/m);
        if (titleMatch) {
            const titleNum = parseInt(titleMatch[1]);
            if (titleNum !== step.number) {
                errors.push({
                    code: "STEP_NUMBER_MISMATCH",
                    message: `Step ${step.number} has title "Step ${titleNum}" - mismatch`,
                    step: step.number,
                });
            }
        }
    } catch {
        errors.push({
            code: "STEP_UNREADABLE",
            message: `Cannot read step file: ${step.filePath}`,
            step: step.number,
        });
    }

    return { errors, warnings };
}

// ===== EVIDENCE USAGE VALIDATION =====

/**
 * Validate that evidence files are referenced in step files
 */
async function validateEvidenceUsage(planPath: string): Promise<{
    warnings: ValidationWarning[];
}> {
    const warnings: ValidationWarning[] = [];

    // Check for evidence directories (both evidence/ and .evidence/)
    const evidenceDir = join(planPath, 'evidence');
    const dotEvidenceDir = join(planPath, '.evidence');
    
    let evidenceFiles: string[] = [];
    let actualEvidenceDir: string | null = null;
    
    // Try evidence/ first
    try {
        const files = await readdir(evidenceDir);
        evidenceFiles = files.filter(f => f.endsWith('.md'));
        actualEvidenceDir = evidenceDir;
    } catch {
        // Try .evidence/
        try {
            const files = await readdir(dotEvidenceDir);
            evidenceFiles = files.filter(f => f.endsWith('.md'));
            actualEvidenceDir = dotEvidenceDir;
        } catch {
            // No evidence directory exists - no warning needed
            return { warnings };
        }
    }
    
    // If no evidence files, no warning needed
    if (evidenceFiles.length === 0) {
        return { warnings };
    }
    
    // Get step files
    const planDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    let stepFiles: string[] = [];
    let stepDir = planDir;
    
    try {
        const files = await readdir(planDir);
        stepFiles = files.filter(f => PLAN_CONVENTIONS.stepPattern.test(f));
    } catch {
        // Plan dir doesn't exist; check root
        try {
            const files = await readdir(planPath);
            stepFiles = files.filter(f => PLAN_CONVENTIONS.stepPattern.test(f));
            stepDir = planPath;
        } catch {
            // Can't read step files - skip validation
            return { warnings };
        }
    }
    
    // If no step files, no warning needed (already caught by other validation)
    if (stepFiles.length === 0) {
        return { warnings };
    }
    
    // Read all step file contents
    let anyStepReferencesEvidence = false;
    
    for (const stepFile of stepFiles) {
        try {
            const stepPath = join(stepDir, stepFile);
            const content = await readFile(stepPath, 'utf-8');
            
            // Check if step mentions evidence directory or any evidence filename
            if (content.includes('evidence/') || content.includes('.evidence/')) {
                anyStepReferencesEvidence = true;
                break;
            }
            
            // Check if any evidence filename is mentioned
            for (const evidenceFile of evidenceFiles) {
                if (content.includes(evidenceFile)) {
                    anyStepReferencesEvidence = true;
                    break;
                }
            }
            
            if (anyStepReferencesEvidence) break;
        } catch {
            // Skip unreadable step files
        }
    }
    
    // If evidence exists but no steps reference it, warn
    if (!anyStepReferencesEvidence) {
        const evidenceDirName = actualEvidenceDir === evidenceDir ? 'evidence/' : '.evidence/';
        warnings.push({
            code: 'EVIDENCE_NOT_REFERENCED',
            message: `Found ${evidenceFiles.length} evidence file(s) in ${evidenceDirName} but no step files reference them. Consider reviewing evidence and incorporating findings into relevant steps.`,
        });
    }
    
    return { warnings };
}

// ===== DEPENDENCY VALIDATION =====

/**
 * Validate step dependencies
 */
function validateDependenciesCheck(steps: PlanStep[]): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
} {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const stepNumbers = new Set(steps.map((s) => s.number));

    for (const step of steps) {
        if (!step.dependencies) continue;

        for (const dep of step.dependencies) {
            // Check dependency exists
            if (!stepNumbers.has(dep)) {
                errors.push({
                    code: "INVALID_DEPENDENCY",
                    message: `Step ${step.number} depends on non-existent step ${dep}`,
                    step: step.number,
                });
            }

            // Check for self-dependency
            if (dep === step.number) {
                errors.push({
                    code: "SELF_DEPENDENCY",
                    message: `Step ${step.number} depends on itself`,
                    step: step.number,
                });
            }

            // Check for backward dependency
            if (dep > step.number) {
                warnings.push({
                    code: "FORWARD_DEPENDENCY",
                    message: `Step ${step.number} depends on later step ${dep}`,
                    step: step.number,
                });
            }
        }
    }

    // Check for circular dependencies
    const circular = detectCircularDependencies(steps);
    for (const cycle of circular) {
        errors.push({
            code: "CIRCULAR_DEPENDENCY",
            message: `Circular dependency detected: ${cycle.join(" → ")}`,
        });
    }

    return { errors, warnings };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(steps: PlanStep[]): number[][] {
    const cycles: number[][] = [];
    const visited = new Set<number>();
    const inStack = new Set<number>();
    const path: number[] = [];

    const stepMap = new Map(steps.map((s) => [s.number, s]));

    function dfs(stepNum: number): void {
        if (inStack.has(stepNum)) {
            // Found cycle
            const cycleStart = path.indexOf(stepNum);
            cycles.push([...path.slice(cycleStart), stepNum]);
            return;
        }

        if (visited.has(stepNum)) return;

        visited.add(stepNum);
        inStack.add(stepNum);
        path.push(stepNum);

        const step = stepMap.get(stepNum);
        if (step?.dependencies) {
            for (const dep of step.dependencies) {
                dfs(dep);
            }
        }

        path.pop();
        inStack.delete(stepNum);
    }

    for (const step of steps) {
        dfs(step.number);
    }

    return cycles;
}

// ===== MAIN VALIDATION FUNCTION =====

/**
 * Validate a plan
 */
export async function validatePlan(
    planPath: string,
    options: ValidateOptions = {}
): Promise<ValidationResult> {
    const {
        validateContent = true,
        validateDependencies: checkDeps = true,
        validateStatus = true,
        strict = false,
    } = options;

    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        fixable: [],
    };

    // Structure validation
    const structure = await validateStructure(planPath);
    result.errors.push(...structure.errors);
    result.warnings.push(...structure.warnings);

    // If directory doesn't exist, return early
    if (structure.errors.some((e) => e.code === "DIR_NOT_FOUND")) {
        result.valid = false;
        return result;
    }

    // Step numbering
    const numbering = await validateStepNumbering(planPath);
    result.errors.push(...numbering.errors);
    result.warnings.push(...numbering.warnings);
    result.fixable.push(...numbering.fixable);

    // Evidence usage validation
    const evidenceUsage = await validateEvidenceUsage(planPath);
    result.warnings.push(...evidenceUsage.warnings);

    // Try to load plan for further validation
    try {
        const { loadPlan } = await import("./loader.js");
        const plan: Plan = await loadPlan(planPath, {
            parseStatus: validateStatus,
        });

        // Content validation
        if (validateContent) {
            for (const step of plan.steps) {
                const content = await validateStepContent(step);
                result.errors.push(...content.errors);
                result.warnings.push(...content.warnings);
            }
        }

        // Dependency validation
        if (checkDeps) {
            const deps = validateDependenciesCheck(plan.steps);
            result.errors.push(...deps.errors);
            result.warnings.push(...deps.warnings);
        }

        // Info
        result.info.push({
            code: "PLAN_LOADED",
            message: `Plan "${plan.metadata.name}" loaded with ${plan.steps.length} steps`,
        });
    } catch (e) {
        result.errors.push({
            code: "LOAD_FAILED",
            message: `Failed to load plan: ${(e as Error).message}`,
        });
    }

    // Determine validity
    if (strict) {
        result.valid =
            result.errors.length === 0 && result.warnings.length === 0;
    } else {
        result.valid = result.errors.length === 0;
    }

    return result;
}

