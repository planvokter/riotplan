/**
 * Migration Template
 *
 * Template for migration projects (data, system, or platform).
 * Focuses on safety, rollback capability, and validation.
 */

import type { PlanTemplate } from "../registry.js";

export const MigrationTemplate: PlanTemplate = {
    id: "migration",
    name: "Migration Plan",
    description:
    "Plan template for migrations (data, system, platform). Emphasizes safety, rollback capability, and thorough validation.",
    category: "operations",
    tags: ["migration", "data", "platform", "upgrade", "operations"],
    phases: [
        {
            name: "Preparation",
            description: "Prepare for migration",
            steps: [0, 1, 2],
        },
        {
            name: "Execution",
            description: "Execute the migration",
            steps: [3, 4],
        },
        {
            name: "Validation",
            description: "Validate and complete",
            steps: [5, 6],
        },
    ],
    steps: [
        {
            title: "Assessment",
            description: "Assess what needs to be migrated.",
            tasks: [
                "Inventory items to migrate",
                "Identify dependencies",
                "Document current state",
                "Assess risks",
            ],
            criteria: [
                "Inventory complete",
                "Dependencies documented",
                "Risks identified",
            ],
        },
        {
            title: "Planning",
            description: "Plan the migration approach.",
            tasks: [
                "Define migration strategy",
                "Plan rollback procedures",
                "Define success criteria",
                "Schedule migration window",
            ],
            criteria: [
                "Strategy documented",
                "Rollback plan ready",
                "Success criteria defined",
            ],
        },
        {
            title: "Preparation",
            description: "Prepare systems and data for migration.",
            tasks: [
                "Set up target environment",
                "Create backup of source",
                "Prepare migration scripts",
                "Test migration in staging",
            ],
            criteria: ["Target ready", "Backup complete", "Scripts tested"],
        },
        {
            title: "Migration Execution",
            description: "Execute the migration.",
            tasks: [
                "Start migration window",
                "Execute migration scripts",
                "Monitor progress",
                "Log all changes",
            ],
            criteria: ["Migration completed", "All items migrated", "Changes logged"],
        },
        {
            title: "Initial Validation",
            description: "Perform initial validation of migrated data/systems.",
            tasks: [
                "Verify data integrity",
                "Check system functionality",
                "Compare source and target",
                "Document discrepancies",
            ],
            criteria: [
                "Data integrity verified",
                "Functionality confirmed",
                "Discrepancies documented",
            ],
        },
        {
            title: "Full Validation",
            description: "Complete validation and user acceptance.",
            tasks: [
                "Run validation scripts",
                "Perform user acceptance testing",
                "Verify all success criteria",
                "Get stakeholder sign-off",
            ],
            criteria: [
                "All validations passed",
                "UAT complete",
                "Stakeholder approval",
            ],
        },
        {
            title: "Completion",
            description: "Finalize migration and clean up.",
            tasks: [
                "Decommission source (if applicable)",
                "Update documentation",
                "Archive migration artifacts",
                "Conduct retrospective",
            ],
            criteria: [
                "Source decommissioned",
                "Documentation updated",
                "Retrospective complete",
            ],
        },
    ],
};
