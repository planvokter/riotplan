/**
 * Plan Validation
 * 
 * Post-generation validation to ensure constraints are addressed,
 * evidence is referenced, and the selected approach is implemented
 */

import type { GeneratedPlan, GenerationContext } from './generator.js';

export interface ValidationResult {
    passed: boolean;
    warnings: string[];
    details: Record<string, any>;
}

export interface ValidationCheck {
    name: string;
    validate(plan: GeneratedPlan, context: GenerationContext): ValidationResult;
}

export interface ValidationReport {
    overallPassed: boolean;
    checks: {
        name: string;
        result: ValidationResult;
    }[];
    allWarnings: string[];
}

/**
 * Constraint Coverage Validation
 * Ensures each constraint from IDEA.md is addressed by at least one step
 */
export class ConstraintCoverageCheck implements ValidationCheck {
    name = 'constraint-coverage';
    
    validate(plan: GeneratedPlan, context: GenerationContext): ValidationResult {
        const warnings: string[] = [];
        const coverage: Record<string, string[]> = {};
        
        const constraints = context.constraints || [];
        
        if (constraints.length === 0) {
            return {
                passed: true,
                warnings: [],
                details: { coverage, message: 'No constraints to validate' },
            };
        }
        
        // Build coverage map from step provenance
        for (const step of plan.steps) {
            if (step.provenance?.constraintsAddressed) {
                for (const constraint of step.provenance.constraintsAddressed) {
                    if (!coverage[constraint]) {
                        coverage[constraint] = [];
                    }
                    coverage[constraint].push(`Step ${step.number}`);
                }
            }
        }
        
        // Check each constraint for coverage
        for (const constraint of constraints) {
            const addressed = Object.keys(coverage).some(key => 
                constraint.includes(key) || key.includes(constraint.substring(0, 50))
            );
            
            if (!addressed) {
                warnings.push(`Constraint not addressed: "${constraint.substring(0, 80)}${constraint.length > 80 ? '...' : ''}"`);
            }
        }
        
        return {
            passed: warnings.length === 0,
            warnings,
            details: { 
                coverage,
                totalConstraints: constraints.length,
                coveredConstraints: constraints.length - warnings.length,
            },
        };
    }
}

/**
 * Evidence Reference Validation
 * Checks if provided evidence files are referenced in the plan
 */
export class EvidenceReferenceCheck implements ValidationCheck {
    name = 'evidence-reference';
    
    validate(plan: GeneratedPlan, context: GenerationContext): ValidationResult {
        const warnings: string[] = [];
        const references: Record<string, string[]> = {};
        
        const evidence = context.evidence || [];
        
        if (evidence.length === 0) {
            return {
                passed: true,
                warnings: [],
                details: { references, message: 'No evidence to validate' },
            };
        }
        
        // Check if evidence is mentioned in analysis
        const analysisFiles = new Set<string>();
        if (plan.analysis?.evidenceAnalysis) {
            for (const ea of plan.analysis.evidenceAnalysis) {
                analysisFiles.add(ea.evidenceFile);
            }
        }
        
        // Build reference map from step provenance
        for (const step of plan.steps) {
            if (step.provenance?.evidenceUsed) {
                for (const evidenceFile of step.provenance.evidenceUsed) {
                    if (!references[evidenceFile]) {
                        references[evidenceFile] = [];
                    }
                    references[evidenceFile].push(`Step ${step.number}`);
                }
            }
        }
        
        // Check each evidence file for references
        for (const ev of evidence) {
            const inAnalysis = analysisFiles.has(ev.name);
            const inSteps = references[ev.name] && references[ev.name].length > 0;
            
            if (!inAnalysis && !inSteps) {
                warnings.push(`Evidence file not referenced: "${ev.name}"`);
            }
        }
        
        return {
            passed: warnings.length === 0,
            warnings,
            details: { 
                references,
                analysisFiles: Array.from(analysisFiles),
                totalEvidence: evidence.length,
                referencedEvidence: evidence.length - warnings.length,
            },
        };
    }
}

/**
 * Selected Approach Validation
 * Ensures the selected approach is reflected in the analysis
 */
export class SelectedApproachCheck implements ValidationCheck {
    name = 'selected-approach';
    
    validate(plan: GeneratedPlan, context: GenerationContext): ValidationResult {
        const warnings: string[] = [];
        
        if (!context.selectedApproach) {
            return {
                passed: true,
                warnings: [],
                details: { message: 'No selected approach to validate' },
            };
        }
        
        const approachName = context.selectedApproach.name;
        
        // Check if approach is mentioned in analysis
        if (!plan.analysis?.approachAnalysis) {
            warnings.push(`Selected approach "${approachName}" not analyzed in the analysis section`);
        } else {
            const analysisText = JSON.stringify(plan.analysis.approachAnalysis).toLowerCase();
            if (!analysisText.includes(approachName.toLowerCase())) {
                warnings.push(`Selected approach "${approachName}" not mentioned in approach analysis`);
            }
        }
        
        // Check if approach is mentioned in plan summary or approach
        const planText = (plan.summary + ' ' + plan.approach).toLowerCase();
        if (!planText.includes(approachName.toLowerCase())) {
            warnings.push(`Selected approach "${approachName}" not mentioned in plan summary or approach`);
        }
        
        return {
            passed: warnings.length === 0,
            warnings,
            details: {
                approachName,
                hasApproachAnalysis: !!plan.analysis?.approachAnalysis,
            },
        };
    }
}

/**
 * Validation Pipeline
 * Runs all validation checks and aggregates results
 */
export class ValidationPipeline {
    private checks: ValidationCheck[] = [];
    
    constructor() {
        // Register default checks
        this.addCheck(new ConstraintCoverageCheck());
        this.addCheck(new EvidenceReferenceCheck());
        this.addCheck(new SelectedApproachCheck());
    }
    
    /**
     * Add a custom validation check
     */
    addCheck(check: ValidationCheck): void {
        this.checks.push(check);
    }
    
    /**
     * Run all validation checks
     */
    validate(plan: GeneratedPlan, context: GenerationContext): ValidationReport {
        const results: { name: string; result: ValidationResult }[] = [];
        const allWarnings: string[] = [];
        
        for (const check of this.checks) {
            const result = check.validate(plan, context);
            results.push({ name: check.name, result });
            allWarnings.push(...result.warnings);
        }
        
        return {
            overallPassed: allWarnings.length === 0,
            checks: results,
            allWarnings,
        };
    }
}

/**
 * Create and run validation pipeline
 */
export function validatePlan(
    plan: GeneratedPlan,
    context: GenerationContext
): ValidationReport {
    const pipeline = new ValidationPipeline();
    return pipeline.validate(plan, context);
}
