/**
 * Template Registry
 *
 * Central registry for all available plan templates.
 */

/**
 * A step definition for a template
 */
export interface TemplateStep {
  /** Step title */
  title: string;

  /** Step description */
  description: string;

  /** Tasks in this step */
  tasks?: string[];

  /** Acceptance criteria */
  criteria?: string[];
}

/**
 * A plan template definition
 */
export interface PlanTemplate {
  /** Unique template ID */
  id: string;

  /** Display name */
  name: string;

  /** Description of the template */
  description: string;

  /** Category */
  category: "general" | "development" | "operations" | "documentation";

  /** Tags for searchability */
  tags: string[];

  /** Default steps for this template */
  steps: TemplateStep[];

  /** Default phases (optional grouping) */
  phases?: Array<{
    name: string;
    description: string;
    steps: number[]; // Step indices
  }>;

  /** Custom SUMMARY.md content template */
  summaryTemplate?: string;

  /** Custom EXECUTION_PLAN.md content template */
  executionPlanTemplate?: string;

  /** Additional files to create */
  additionalFiles?: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Central registry of all templates
 */
export const TEMPLATE_REGISTRY: Map<string, PlanTemplate> = new Map();

/**
 * Register a template
 */
export function registerTemplate(template: PlanTemplate): void {
    TEMPLATE_REGISTRY.set(template.id, template);
}

/**
 * Get a template by ID
 */
export function getTemplate(id: string): PlanTemplate | undefined {
    return TEMPLATE_REGISTRY.get(id);
}

/**
 * List all available templates
 */
export function listTemplates(): PlanTemplate[] {
    return Array.from(TEMPLATE_REGISTRY.values());
}

/**
 * List templates by category
 */
export function listTemplatesByCategory(
    category: PlanTemplate["category"],
): PlanTemplate[] {
    return listTemplates().filter((t) => t.category === category);
}

/**
 * Search templates by tag
 */
export function searchTemplatesByTag(tag: string): PlanTemplate[] {
    return listTemplates().filter((t) => t.tags.includes(tag));
}
