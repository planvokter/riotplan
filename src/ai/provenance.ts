/**
 * Provenance Documentation
 * 
 * Generates PROVENANCE.md to document how the plan connects to idea artifacts
 */

import type { GeneratedPlan, GenerationContext } from './generator.js';
import type { ValidationReport } from './validation.js';
import type { TieringDecision } from './tokens.js';

export interface ProvenanceData {
    plan: GeneratedPlan;
    context: GenerationContext;
    validation: ValidationReport;
    tiering?: TieringDecision;
    generatedAt: Date;
}

/**
 * Generate PROVENANCE.md content
 */
export function generateProvenanceMarkdown(data: ProvenanceData): string {
    const { plan, context, validation, tiering, generatedAt } = data;
    
    const sections: string[] = [];
    
    // Header
    sections.push(`# Plan Provenance

This document traces how the generated plan connects to the idea artifacts.`);
    
    // Generation metadata
    sections.push(`## How This Plan Was Generated

- **Generated**: ${generatedAt.toISOString()}
- **Constraints**: ${context.constraints?.length || 0}
- **Evidence files**: ${context.evidence?.length || 0}
- **Selected approach**: ${context.selectedApproach?.name || 'None'}
- **History events**: ${context.historyContext?.totalEvents || 0}`);
    
    // Artifact Analysis section
    sections.push(`## Artifact Analysis`);
    
    // Constraints
    if (plan.analysis?.constraintAnalysis && plan.analysis.constraintAnalysis.length > 0) {
        sections.push(`### Constraints

The model analyzed ${plan.analysis.constraintAnalysis.length} constraint(s):

| # | Constraint | Addressed By | Model's Understanding |
|---|-----------|-------------|----------------------|`);
        
        for (let i = 0; i < plan.analysis.constraintAnalysis.length; i++) {
            const ca = plan.analysis.constraintAnalysis[i];
            
            // Find which steps address this constraint
            const addressedBy: string[] = [];
            for (const step of plan.steps) {
                if (step.provenance?.constraintsAddressed) {
                    for (const constraintRef of step.provenance.constraintsAddressed) {
                        if (ca.constraint.includes(constraintRef) || constraintRef.includes(ca.constraint.substring(0, 30))) {
                            addressedBy.push(`Step ${step.number}`);
                            break;
                        }
                    }
                }
            }
            
            const constraintText = ca.constraint.length > 60 
                ? ca.constraint.substring(0, 60) + '...' 
                : ca.constraint;
            const understanding = ca.understanding.length > 80 
                ? ca.understanding.substring(0, 80) + '...' 
                : ca.understanding;
            const steps = addressedBy.length > 0 ? addressedBy.join(', ') : '*(none)*';
            
            sections.push(`| ${i + 1} | ${constraintText} | ${steps} | ${understanding} |`);
        }
    } else if (context.constraints && context.constraints.length > 0) {
        sections.push(`### Constraints

${context.constraints.length} constraint(s) were provided but not analyzed in the response.`);
    }
    
    // Evidence
    if (plan.analysis?.evidenceAnalysis && plan.analysis.evidenceAnalysis.length > 0) {
        sections.push(`
### Evidence Used

The model analyzed ${plan.analysis.evidenceAnalysis.length} evidence file(s):

| File | Key Findings | Referenced In |
|------|-------------|--------------|`);
        
        for (const ea of plan.analysis.evidenceAnalysis) {
            // Find which steps reference this evidence
            const referencedIn: string[] = [];
            for (const step of plan.steps) {
                if (step.provenance?.evidenceUsed?.includes(ea.evidenceFile)) {
                    referencedIn.push(`Step ${step.number}`);
                }
            }
            
            const findings = ea.keyFindings.length > 100 
                ? ea.keyFindings.substring(0, 100) + '...' 
                : ea.keyFindings;
            const refs = referencedIn.length > 0 ? referencedIn.join(', ') : '*(none)*';
            
            sections.push(`| ${ea.evidenceFile} | ${findings} | ${refs} |`);
        }
    } else if (context.evidence && context.evidence.length > 0) {
        sections.push(`
### Evidence Used

${context.evidence.length} evidence file(s) were provided but not analyzed in the response.`);
    }
    
    // Selected Approach
    if (plan.analysis?.approachAnalysis) {
        const aa = plan.analysis.approachAnalysis;
        sections.push(`
### Selected Approach

- **Approach**: ${aa.selectedApproach}
- **Commitments**: ${aa.commitments}
- **Implementation Strategy**: ${aa.implementationStrategy}`);
    } else if (context.selectedApproach) {
        sections.push(`
### Selected Approach

A selected approach ("${context.selectedApproach.name}") was provided but not analyzed in the response.`);
    }
    
    // Risks
    if (plan.analysis?.risks && plan.analysis.risks.length > 0) {
        sections.push(`
### Risks Identified

${plan.analysis.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    }
    
    // Coverage Warnings
    if (validation.allWarnings.length > 0) {
        sections.push(`## Coverage Warnings

The following gaps were detected during validation:

${validation.allWarnings.map(w => `- ${w}`).join('\n')}`);
    } else {
        sections.push(`## Coverage Validation

✅ All constraints addressed, all evidence referenced, selected approach implemented.`);
    }
    
    // Token Budget
    if (tiering) {
        sections.push(`## Token Budget

- **Estimated tokens**: ${tiering.totalEstimatedTokens}
- **Budget exceeded**: ${tiering.budgetExceeded ? 'Yes' : 'No'}`);
        
        if (tiering.evidenceTiered.full.length > 0) {
            sections.push(`- **Evidence (full)**: ${tiering.evidenceTiered.full.join(', ')}`);
        }
        if (tiering.evidenceTiered.summarized.length > 0) {
            sections.push(`- **Evidence (summarized)**: ${tiering.evidenceTiered.summarized.join(', ')}`);
        }
        if (tiering.evidenceTiered.listOnly.length > 0) {
            sections.push(`- **Evidence (preview only)**: ${tiering.evidenceTiered.listOnly.join(', ')}`);
        }
        if (tiering.historyAbbreviated) {
            sections.push(`- **History**: abbreviated to most recent events`);
        }
        
        if (tiering.warnings.length > 0) {
            sections.push(`
### Tiering Warnings

${tiering.warnings.map(w => `- ${w}`).join('\n')}`);
        }
    }
    
    // Step Provenance Summary
    sections.push(`## Step Provenance

How each step connects to the idea artifacts:
`);
    
    for (const step of plan.steps) {
        sections.push(`### Step ${step.number}: ${step.title}`);
        
        if (step.provenance) {
            if (step.provenance.rationale) {
                sections.push(`\n**Rationale**: ${step.provenance.rationale}`);
            }
            
            if (step.provenance.constraintsAddressed && step.provenance.constraintsAddressed.length > 0) {
                sections.push(`\n**Addresses constraints**: ${step.provenance.constraintsAddressed.join(', ')}`);
            }
            
            if (step.provenance.evidenceUsed && step.provenance.evidenceUsed.length > 0) {
                sections.push(`\n**Uses evidence**: ${step.provenance.evidenceUsed.join(', ')}`);
            }
        } else {
            sections.push(`\n*(No provenance data)*`);
        }
        
        sections.push(''); // Empty line between steps
    }
    
    return sections.join('\n\n');
}
