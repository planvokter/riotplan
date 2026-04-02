export {
    TEMPLATE_REGISTRY,
    getTemplate,
    listTemplates,
    registerTemplate,
    listTemplatesByCategory,
    searchTemplatesByTag,
    type PlanTemplate,
    type TemplateStep,
} from './registry.js';
export {
    applyTemplate,
    type ApplyTemplateOptions,
    type ApplyTemplateResult,
    type CreatePlanConfig,
    type CreatePlanResult,
    type CreatePlanFn,
} from './apply.js';
export {
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
} from './templates/index.js';
