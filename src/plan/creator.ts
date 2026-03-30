/**
 * Plan Creator Module
 *
 * High-level API for creating new plans.
 */

import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import type {
    PlanMetadata as FormatMetadata,
    PlanStep as FormatStep,
} from "@kjerneverk/riotplan-format";

export interface CreatePlanConfig {
    /** Plan code (directory name) */
    code: string;
    /** Plan display name */
    name: string;
    /** Plan description (optional) */
    description?: string;
    /** Base path for plans (default: current directory) */
    basePath?: string;
    /** Steps for the plan */
    steps: Array<{
        title: string;
        description?: string;
    }>;
    /** Tags for the plan */
    tags?: string[];
}

export interface CreatePlanResult {
    success: boolean;
    path?: string;
    error?: string;
}

/**
 * Create a new plan from configuration
 *
 * @param config - Plan creation configuration
 * @returns Result with plan path on success
 */
export async function createPlan(
    config: CreatePlanConfig
): Promise<CreatePlanResult> {
    const { code, name, description, basePath = ".", steps } = config;

    // Create plan directory path
    const planPath = join(basePath, `${code}.plan`);
    const planDir = dirname(planPath);

    try {
        // Ensure directory exists
        await mkdir(planDir, { recursive: true });

        // Create storage provider
        const provider = createSqliteProvider(planPath);

        try {
            // Initialize plan metadata
            const now = new Date().toISOString();
            const metadata: FormatMetadata = {
                id: code,
                uuid: randomUUID(),
                name,
                description,
                stage: "idea",
                createdAt: now,
                updatedAt: now,
                schemaVersion: 1,
            };

            const initResult = await provider.initialize(metadata);
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }

            // Add steps
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const formatStep: FormatStep = {
                    number: i + 1,
                    code: slugify(step.title),
                    title: step.title,
                    description: step.description,
                    content: `# ${step.title}\n\n${step.description || ""}`,
                    status: "pending",
                };

                const stepResult = await provider.addStep(formatStep);
                if (!stepResult.success) {
                    return {
                        success: false,
                        error: `Failed to add step ${i + 1}: ${stepResult.error}`,
                    };
                }
            }

            return { success: true, path: planPath };
        } finally {
            await provider.close();
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Convert a string to a URL-safe slug
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}
