/**
 * Built-in Plan Templates
 *
 * Standard templates for common plan types.
 */

export { BasicTemplate } from "./basic.js";
export { FeatureTemplate } from "./feature.js";
export { RefactoringTemplate } from "./refactoring.js";
export { MigrationTemplate } from "./migration.js";
export { SprintTemplate } from "./sprint.js";

// Import and register all templates
import { registerTemplate } from "../registry.js";
import { BasicTemplate } from "./basic.js";
import { FeatureTemplate } from "./feature.js";
import { RefactoringTemplate } from "./refactoring.js";
import { MigrationTemplate } from "./migration.js";
import { SprintTemplate } from "./sprint.js";

// Register built-in templates
registerTemplate(BasicTemplate);
registerTemplate(FeatureTemplate);
registerTemplate(RefactoringTemplate);
registerTemplate(MigrationTemplate);
registerTemplate(SprintTemplate);
