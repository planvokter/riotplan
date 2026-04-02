import { describe, it, expect, beforeEach } from "vitest";
import {
    TEMPLATE_REGISTRY,
    registerTemplate,
    getTemplate,
    listTemplates,
    listTemplatesByCategory,
    searchTemplatesByTag,
    type PlanTemplate,
} from "../src/registry.js";
import { applyTemplate } from "../src/apply.js";
import {
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
} from "../src/templates/index.js";

const builtInTemplates: PlanTemplate[] = [
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
];

describe("registry", () => {
    beforeEach(() => {
        TEMPLATE_REGISTRY.clear();
    });

    describe("registerTemplate", () => {
        it("adds template to registry and can be retrieved", () => {
            registerTemplate(BasicTemplate);
            expect(getTemplate("basic")).toEqual(BasicTemplate);
        });

        it("overwrites existing template with same id", () => {
            registerTemplate(BasicTemplate);
            const modified = { ...BasicTemplate, name: "Modified Basic" };
            registerTemplate(modified);
            expect(getTemplate("basic")).toEqual(modified);
        });
    });

    describe("getTemplate", () => {
        it("returns undefined when template not found", () => {
            expect(getTemplate("nonexistent")).toBeUndefined();
        });

        it("returns template when found", () => {
            registerTemplate(BasicTemplate);
            expect(getTemplate("basic")).toBe(BasicTemplate);
        });
    });

    describe("listTemplates", () => {
        it("returns empty array when registry is empty", () => {
            expect(listTemplates()).toEqual([]);
        });

        it("returns all registered templates", () => {
            registerTemplate(BasicTemplate);
            registerTemplate(FeatureTemplate);
            const result = listTemplates();
            expect(result).toHaveLength(2);
            expect(result).toContain(BasicTemplate);
            expect(result).toContain(FeatureTemplate);
        });
    });

    describe("listTemplatesByCategory", () => {
        beforeEach(() => {
            builtInTemplates.forEach((t) => registerTemplate(t));
        });

        it("returns only templates in the specified category", () => {
            const development = listTemplatesByCategory("development");
            expect(development).toHaveLength(2);
            expect(development.every((t) => t.category === "development")).toBe(
                true,
            );
            expect(development.map((t) => t.id)).toContain("feature");
            expect(development.map((t) => t.id)).toContain("refactoring");
        });

        it("returns empty array when no templates match category", () => {
            const docs = listTemplatesByCategory("documentation");
            expect(docs).toEqual([]);
        });

        it("returns general category templates", () => {
            const general = listTemplatesByCategory("general");
            expect(general.map((t) => t.id)).toContain("basic");
            expect(general.map((t) => t.id)).toContain("sprint");
        });
    });

    describe("searchTemplatesByTag", () => {
        beforeEach(() => {
            builtInTemplates.forEach((t) => registerTemplate(t));
        });

        it("returns templates that include the tag", () => {
            const agile = searchTemplatesByTag("agile");
            expect(agile.length).toBeGreaterThanOrEqual(1);
            expect(agile.every((t) => t.tags.includes("agile"))).toBe(true);
        });

        it("returns empty array when no templates have the tag", () => {
            const result = searchTemplatesByTag("nonexistent-tag");
            expect(result).toEqual([]);
        });

        it("returns multiple templates when tag matches several", () => {
            const development = searchTemplatesByTag("development");
            expect(development.length).toBeGreaterThanOrEqual(1);
        });
    });
});

describe("applyTemplate", () => {
    const baseOptions = {
        templateId: "basic",
        code: "my-plan",
        name: "My Plan",
        basePath: "/tmp/plans",
        createPlan: async (config: { code: string; name: string; basePath: string }) => ({
            path: `${config.basePath}/${config.code}`,
        }),
    };

    beforeEach(() => {
        TEMPLATE_REGISTRY.clear();
    });

    it("returns success with path and template when createPlan succeeds", async () => {
        registerTemplate(BasicTemplate);
        const result = await applyTemplate(baseOptions);
        expect(result.success).toBe(true);
        expect(result.path).toBe("/tmp/plans/my-plan");
        expect(result.template).toEqual(BasicTemplate);
    });

    it("returns error when template not found", async () => {
        const result = await applyTemplate({
            ...baseOptions,
            templateId: "nonexistent",
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Template not found: nonexistent");
    });

    it("returns error when createPlan throws", async () => {
        registerTemplate(BasicTemplate);
        const result = await applyTemplate({
            ...baseOptions,
            createPlan: async () => {
                throw new Error("createPlan failed");
            },
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("createPlan failed");
    });

    it("returns generic error message when createPlan throws non-Error", async () => {
        registerTemplate(BasicTemplate);
        const result = await applyTemplate({
            ...baseOptions,
            createPlan: async () => {
                throw "string error";
            },
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Unknown error applying template");
    });

    it("substitutes variables in description and steps", async () => {
        const templateWithVars: PlanTemplate = {
            ...BasicTemplate,
            id: "with-vars",
            description: "Plan for {{project}}",
            steps: [
                {
                    title: "Step {{n}}",
                    description: "Do {{action}}",
                },
            ],
        };
        registerTemplate(templateWithVars);

        let capturedConfig: { description?: string; steps?: Array<{ title: string; description: string }> } | null = null;
        const result = await applyTemplate({
            ...baseOptions,
            templateId: "with-vars",
            variables: {
                project: "Acme",
                n: "1",
                action: "review",
            },
            createPlan: async (config) => {
                capturedConfig = config;
                return { path: config.basePath + "/" + config.code };
            },
        });

        expect(result.success).toBe(true);
        expect(capturedConfig?.description).toBe("Plan for Acme");
        expect(capturedConfig?.steps?.[0]?.title).toBe("Step 1");
        expect(capturedConfig?.steps?.[0]?.description).toBe("Do review");
    });

    it("uses custom description when provided", async () => {
        registerTemplate(BasicTemplate);
        let capturedConfig: { description?: string } | null = null;
        await applyTemplate({
            ...baseOptions,
            description: "Custom description override",
            createPlan: async (config) => {
                capturedConfig = config;
                return { path: config.basePath + "/" + config.code };
            },
        });
        expect(capturedConfig?.description).toBe("Custom description override");
    });

    it("passes correct config to createPlan", async () => {
        registerTemplate(BasicTemplate);
        let capturedConfig: { code: string; name: string; basePath: string; steps?: unknown[] } | null = null;
        await applyTemplate({
            ...baseOptions,
            createPlan: async (config) => {
                capturedConfig = config;
                return { path: config.basePath + "/" + config.code };
            },
        });
        expect(capturedConfig?.code).toBe("my-plan");
        expect(capturedConfig?.name).toBe("My Plan");
        expect(capturedConfig?.basePath).toBe("/tmp/plans");
        expect(capturedConfig?.steps).toHaveLength(BasicTemplate.steps.length);
    });
});

describe("built-in templates", () => {
    beforeEach(() => {
        TEMPLATE_REGISTRY.clear();
        builtInTemplates.forEach((t) => registerTemplate(t));
    });

    it("registers all 5 built-in templates", () => {
        const templates = listTemplates();
        expect(templates).toHaveLength(5);
        const ids = templates.map((t) => t.id).sort();
        expect(ids).toEqual(["basic", "feature", "migration", "refactoring", "sprint"]);
    });

    it("each template has required structure", () => {
        for (const template of builtInTemplates) {
            expect(template.id).toBeDefined();
            expect(template.name).toBeDefined();
            expect(template.description).toBeDefined();
            expect(template.category).toMatch(/^(general|development|operations|documentation)$/);
            expect(Array.isArray(template.tags)).toBe(true);
            expect(Array.isArray(template.steps)).toBe(true);
            expect(template.steps.length).toBeGreaterThan(0);
        }
    });

    it("BasicTemplate has expected category and tags", () => {
        expect(BasicTemplate.category).toBe("general");
        expect(BasicTemplate.tags).toContain("basic");
        expect(BasicTemplate.tags).toContain("simple");
    });

    it("FeatureTemplate has phases", () => {
        expect(FeatureTemplate.phases).toBeDefined();
        expect(FeatureTemplate.phases!.length).toBeGreaterThan(0);
    });

    it("MigrationTemplate has operations category", () => {
        expect(MigrationTemplate.category).toBe("operations");
    });
});
