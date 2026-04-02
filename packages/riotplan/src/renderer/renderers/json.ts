/**
 * JSON Renderer
 *
 * Render a plan to JSON format.
 */

import type { Plan } from "../../types.js";

/**
 * Options for JSON rendering
 */
export interface JsonRenderOptions {
    /** Pretty print with indentation */
    pretty?: boolean;

    /** Indentation (spaces or tab) */
    indent?: number | string;

    /** Include full step content */
    includeStepContent?: boolean;

    /** Include feedback records */
    includeFeedback?: boolean;

    /** Include evidence records */
    includeEvidence?: boolean;

    /** Only include specific fields */
    fields?: string[];
}

/**
 * Default options for JSON rendering
 */
const DEFAULT_OPTIONS: JsonRenderOptions = {
    pretty: true,
    indent: 2,
    includeStepContent: false,
    includeFeedback: true,
    includeEvidence: true,
};

/**
 * JSON export format
 */
interface PlanExport {
    metadata: {
        code: string;
        name: string;
        description?: string;
        author?: string;
        created?: string;
        context?: string;
    };
    status: {
        status: string;
        progress: number;
        currentStep?: number;
        completedSteps: number[];
        blockedSteps: number[];
    };
    steps: Array<{
        number: number;
        title: string;
        description?: string;
        status: string;
        started?: string;
        completed?: string;
        notes?: string;
    }>;
    feedback?: Array<{
        id: string;
        title: string;
        platform: string;
        createdAt: string;
    }>;
    evidence?: Array<{
        id: string;
        type: string;
        title: string;
        source?: string;
    }>;
    exportedAt: string;
}

/**
 * Render a plan to JSON
 */
export function renderToJson(
    plan: Plan,
    options?: Partial<JsonRenderOptions>,
): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const steps = plan.steps || [];
    const completedSteps = steps
        .filter((s) => s.status === "completed")
        .map((s) => s.number);
    const blockedSteps = steps
        .filter((s) => s.status === "blocked")
        .map((s) => s.number);

    const exported: PlanExport = {
        metadata: {
            code: plan.metadata.code,
            name: plan.metadata.name,
            description: plan.metadata.description,
            author: plan.metadata.author,
            created: plan.metadata.createdAt
                ? formatDate(plan.metadata.createdAt)
                : undefined,
            context: plan.context,
        },
        status: {
            status: plan.state.status,
            progress: plan.state.progress,
            currentStep: plan.state.currentStep,
            completedSteps,
            blockedSteps,
        },
        steps: steps.map((step) => ({
            number: step.number,
            title: step.title,
            description: step.description,
            status: step.status,
            started: step.startedAt ? formatDate(step.startedAt) : undefined,
            completed: step.completedAt ? formatDate(step.completedAt) : undefined,
            ...(opts.includeStepContent ? { notes: step.notes } : {}),
        })),
        exportedAt: new Date().toISOString(),
    };

    // Include feedback if requested
    if (opts.includeFeedback && plan.feedback) {
        exported.feedback = plan.feedback.map((f) => ({
            id: f.id,
            title: f.title,
            platform: f.platform,
            createdAt: formatDate(f.createdAt),
        }));
    }

    // Include evidence if requested
    if (opts.includeEvidence && plan.evidence) {
        exported.evidence = plan.evidence.map((e) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            source: e.source,
        }));
    }

    // Filter fields if specified
    if (opts.fields && opts.fields.length > 0) {
        const filtered: Record<string, unknown> = {};
        for (const field of opts.fields) {
            if (field in exported) {
                filtered[field] = exported[field as keyof PlanExport];
            }
        }
        return opts.pretty
            ? JSON.stringify(filtered, null, opts.indent)
            : JSON.stringify(filtered);
    }

    return opts.pretty
        ? JSON.stringify(exported, null, opts.indent)
        : JSON.stringify(exported);
}

/**
 * Format a date
 */
function formatDate(date: Date): string {
    if (typeof date === "string") {
        return date;
    }
    return date.toISOString();
}
