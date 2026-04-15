/**
 * Template Application
 *
 * Apply a template to create a new plan.
 */

import { getTemplate, type PlanTemplate } from "./registry.js";

/**
 * Minimal plan creation config accepted by the createPlan callback.
 * Mirrors the shape from @planvokter/riotplan without importing it.
 */
export interface CreatePlanConfig {
    code: string;
    name: string;
    basePath: string;
    description?: string;
    steps?: Array<{ title: string; description: string }>;
    tags?: string[];
}

export interface CreatePlanResult {
    path: string;
}

/**
 * A function that creates a plan from a config.
 * Callers pass in the real createPlan from @planvokter/riotplan.
 */
export type CreatePlanFn = (config: CreatePlanConfig) => Promise<CreatePlanResult>;

/**
 * Options for applying a template
 */
export interface ApplyTemplateOptions {
  /** Template ID to apply */
  templateId: string;

  /** Plan code (directory name) */
  code: string;

  /** Plan display name */
  name: string;

  /** Base path to create the plan in */
  basePath: string;

  /** Function that creates a plan (pass createPlan from @planvokter/riotplan) */
  createPlan: CreatePlanFn;

  /** Custom description (overrides template) */
  description?: string;

  /** Variable substitutions for template content */
  variables?: Record<string, string>;

  /** Additional tags to add */
  tags?: string[];
}

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** Whether application succeeded */
  success: boolean;

  /** Path to created plan */
  path?: string;

  /** Template that was applied */
  template?: PlanTemplate;

  /** Error message if failed */
  error?: string;
}

/**
 * Apply a template to create a new plan
 */
export async function applyTemplate(
    options: ApplyTemplateOptions,
): Promise<ApplyTemplateResult> {
    const { templateId, code, name, basePath, description, variables, tags, createPlan } = options;

    const template = getTemplate(templateId);
    if (!template) {
        return {
            success: false,
            error: `Template not found: ${templateId}`,
        };
    }

    try {
        const config: CreatePlanConfig = {
            code,
            name,
            basePath,
            description:
        description ?? substituteVariables(template.description, variables),
            steps: template.steps.map((step) => ({
                title: substituteVariables(step.title, variables),
                description: substituteVariables(step.description, variables),
            })),
            tags: tags
                ? [...new Set([...template.tags, ...tags])]
                : template.tags,
        };

        const result = await createPlan(config);

        return {
            success: true,
            path: result.path,
            template,
        };
    } catch (error) {
        return {
            success: false,
            error:
        error instanceof Error
            ? error.message
            : "Unknown error applying template",
        };
    }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Substitute variables in a string
 */
function substituteVariables(
    text: string,
    variables?: Record<string, string>,
): string {
    if (!variables) return text;

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        // Use a function replacement to avoid special replacement patterns ($&, $1, $`, $', $$)
        // being interpreted by String.prototype.replace() when the first arg is a RegExp.
        // Without this, a value like "Price: $50" would be corrupted because $5 is
        // interpreted as a backreference (replaced with empty string).
        result = result.replace(
            new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, "g"),
            () => value,
        );
    }
    return result;
}
