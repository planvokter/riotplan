/**
 * Markdown Renderer
 * 
 * Renders plan data to markdown format for export.
 */

import type { StorageProvider } from '../storage/provider.js';
import type { PlanMetadata, PlanStep, EvidenceRecord, FeedbackRecord } from '../types.js';

/**
 * Options for markdown rendering
 */
export interface MarkdownRenderOptions {
    /** Include timeline events in output */
    includeTimeline?: boolean;
    
    /** Include evidence records */
    includeEvidence?: boolean;
    
    /** Include feedback records */
    includeFeedback?: boolean;
    
    /** Include source format metadata */
    includeSourceInfo?: boolean;
}

/**
 * Rendered plan as markdown files
 */
export interface RenderedPlan {
    /** Main files (SUMMARY.md, STATUS.md, etc.) */
    files: Map<string, string>;
    
    /** Step files (plan/01-step.md, etc.) */
    steps: Map<string, string>;
    
    /** Evidence files (evidence/*.md) */
    evidence: Map<string, string>;
    
    /** Feedback files (feedback/*.md) */
    feedback: Map<string, string>;
}

/**
 * Render a plan to markdown format
 */
export async function renderPlanToMarkdown(
    provider: StorageProvider,
    options: MarkdownRenderOptions = {}
): Promise<RenderedPlan> {
    const result: RenderedPlan = {
        files: new Map(),
        steps: new Map(),
        evidence: new Map(),
        feedback: new Map(),
    };

    // Get metadata
    const metadataResult = await provider.getMetadata();
    if (metadataResult.success && metadataResult.data) {
        result.files.set('SUMMARY.md', renderSummary(metadataResult.data, options));
        result.files.set('STATUS.md', await renderStatus(provider, metadataResult.data));
    }

    // Get and render existing files
    const filesResult = await provider.getFiles();
    if (filesResult.success && filesResult.data) {
        for (const file of filesResult.data) {
            result.files.set(file.filename, file.content);
        }
    }

    // Get and render steps
    const stepsResult = await provider.getSteps();
    if (stepsResult.success && stepsResult.data) {
        for (const step of stepsResult.data) {
            const filename = formatStepFilename(step);
            result.steps.set(filename, step.content);
        }
    }

    // Get and render evidence
    if (options.includeEvidence !== false) {
        const evidenceResult = await provider.getEvidence();
        if (evidenceResult.success && evidenceResult.data) {
            for (const evidence of evidenceResult.data) {
                const filename = `${evidence.id}.md`;
                result.evidence.set(filename, renderEvidence(evidence));
            }
        }
    }

    // Get and render feedback
    if (options.includeFeedback !== false) {
        const feedbackResult = await provider.getFeedback();
        if (feedbackResult.success && feedbackResult.data) {
            for (const feedback of feedbackResult.data) {
                const filename = `${feedback.id}.md`;
                result.feedback.set(filename, renderFeedback(feedback));
            }
        }
    }

    return result;
}

/**
 * Render plan summary
 */
function renderSummary(metadata: PlanMetadata, options: MarkdownRenderOptions): string {
    const lines: string[] = [
        `# ${metadata.name}`,
        '',
        '## Overview',
        '',
        metadata.description || '_No description provided._',
        '',
        '## Metadata',
        '',
        `- **ID**: ${metadata.id}`,
        `- **Stage**: ${metadata.stage}`,
        `- **Created**: ${metadata.createdAt}`,
        `- **Updated**: ${metadata.updatedAt}`,
    ];

    if (options.includeSourceInfo) {
        lines.push(`- **Schema Version**: ${metadata.schemaVersion}`);
    }

    lines.push('', '---', '', `*Generated: ${new Date().toISOString()}*`);

    return lines.join('\n');
}

/**
 * Render plan status
 */
async function renderStatus(provider: StorageProvider, metadata: PlanMetadata): Promise<string> {
    const stepsResult = await provider.getSteps();
    const steps = stepsResult.data || [];

    const completed = steps.filter(s => s.status === 'completed').length;
    const inProgress = steps.filter(s => s.status === 'in_progress').length;
    const pending = steps.filter(s => s.status === 'pending').length;
    const total = steps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const statusEmoji = getStatusEmoji(metadata.stage, inProgress > 0);

    const lines: string[] = [
        `# ${metadata.name} Status`,
        '',
        '## Current State',
        '',
        '| Field | Value |',
        '|-------|-------|',
        `| **Status** | ${statusEmoji} ${metadata.stage.toUpperCase()} |`,
        `| **Progress** | ${percentage}% (${completed}/${total} steps) |`,
        `| **In Progress** | ${inProgress} |`,
        `| **Pending** | ${pending} |`,
        `| **Last Updated** | ${metadata.updatedAt.split('T')[0]} |`,
        '',
        '## Step Progress',
        '',
        '| Step | Name | Status | Started | Completed |',
        '|------|------|--------|---------|-----------|',
    ];

    for (const step of steps) {
        const statusIcon = getStepStatusIcon(step.status);
        lines.push(
            `| ${String(step.number).padStart(2, '0')} | ${step.title} | ${statusIcon} | ${step.startedAt?.split('T')[0] || '-'} | ${step.completedAt?.split('T')[0] || '-'} |`
        );
    }

    lines.push('', '---', '', `*Last updated: ${new Date().toISOString().split('T')[0]}*`);

    return lines.join('\n');
}

/**
 * Format step filename
 */
function formatStepFilename(step: PlanStep): string {
    const num = String(step.number).padStart(2, '0');
    const code = step.code || step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${num}-${code}.md`;
}

/**
 * Render evidence record to markdown
 */
function renderEvidence(evidence: EvidenceRecord): string {
    const lines: string[] = [
        '---',
        `id: ${evidence.id}`,
        `date: ${evidence.createdAt}`,
    ];

    if (evidence.source) {
        lines.push(`source: ${evidence.source}`);
    }
    if (evidence.sourceUrl) {
        lines.push(`url: ${evidence.sourceUrl}`);
    }
    if (evidence.gatheringMethod) {
        lines.push(`gathering_method: ${evidence.gatheringMethod}`);
    }

    lines.push('---', '', `# ${evidence.description}`, '');

    if (evidence.content) {
        lines.push(evidence.content);
    }

    return lines.join('\n');
}

/**
 * Render feedback record to markdown
 */
function renderFeedback(feedback: FeedbackRecord): string {
    const lines: string[] = [
        '---',
        `id: ${feedback.id}`,
        `date: ${feedback.createdAt}`,
    ];

    if (feedback.title) {
        lines.push(`title: ${feedback.title}`);
    }
    if (feedback.platform) {
        lines.push(`platform: ${feedback.platform}`);
    }
    if (feedback.participants && feedback.participants.length > 0) {
        lines.push(`participants: [${feedback.participants.join(', ')}]`);
    }

    lines.push('---', '');

    if (feedback.title) {
        lines.push(`# ${feedback.title}`, '');
    }

    lines.push(feedback.content);

    return lines.join('\n');
}

/**
 * Get status emoji based on stage
 */
function getStatusEmoji(stage: string, hasInProgress: boolean): string {
    if (stage === 'completed') return '✅';
    if (stage === 'cancelled') return '❌';
    if (hasInProgress) return '🔄';
    if (stage === 'executing') return '🔄';
    if (stage === 'built') return '📋';
    if (stage === 'shaping') return '🔧';
    return '⬜';
}

/**
 * Get step status icon
 */
function getStepStatusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✅';
        case 'in_progress': return '🔄';
        case 'skipped': return '⏭️';
        default: return '⬜';
    }
}
