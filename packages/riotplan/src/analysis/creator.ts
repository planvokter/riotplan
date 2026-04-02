import { savePlanDoc } from "../artifacts/operations.js";

export interface CreateAnalysisOptions {
    planPath: string;
    planName: string;
    initialPrompt: string;
}

/**
 * Create analysis entries in a .plan SQLite file
 */
export async function createAnalysisDirectory(
    options: CreateAnalysisOptions
): Promise<string> {
    const { planPath, planName, initialPrompt } = options;
    const requirementsContent = generateRequirementsTemplate(planName, initialPrompt);
    await savePlanDoc(planPath, "other", "analysis/REQUIREMENTS.md", requirementsContent);
    return "analysis";
}

function generateRequirementsTemplate(planName: string, prompt: string): string {
    return `# ${formatPlanName(planName)} - Requirements Analysis

## Status

| Field | Value |
|-------|-------|
| **Status** | \`draft\` |
| **Created** | ${new Date().toISOString().split("T")[0]} |
| **Last Updated** | ${new Date().toISOString().split("T")[0]} |
| **Elaborations** | 0 |

## Initial Prompt

${prompt}

---

## Requirements

> This section should be elaborated based on the initial prompt.
> Use \`riotplan elaborate\` to provide feedback and refine requirements.

### Functional Requirements

_To be elaborated..._

### Non-Functional Requirements

_To be elaborated..._

### Constraints

_To be elaborated..._

### Assumptions

_To be elaborated..._

---

## Verification Criteria

> These criteria will be used to verify the plan addresses all requirements.

### Must Have

- [ ] _To be defined..._

### Should Have

- [ ] _To be defined..._

### Could Have

- [ ] _To be defined..._

---

## Notes

_Add any additional context or notes here._
`;
}

function formatPlanName(name: string): string {
    return name
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
