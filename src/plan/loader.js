/**
 * Plan Loader Module
 *
 * Loads plans from SQLite .plan files into Plan data structures.
 */
import { join, resolve } from "node:path";
import { PLAN_CONVENTIONS } from "../types.js";
import { parseDependenciesFromContent } from "../dependencies/index.js";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
/**
 * Load a plan from a .plan SQLite file
 *
 * @param path - Path to the .plan file
 * @param options - Loading options
 * @returns The loaded plan
 */
export async function loadPlan(path, options = {}) {
    const planPath = resolve(path);
    const { parseStatus = true } = options;
    const provider = createSqliteProvider(planPath);
    try {
        const [metadataResult, stepsResult, filesResult] = await Promise.all([
            provider.getMetadata(),
            provider.getSteps(),
            provider.getFiles(),
        ]);
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || "Failed to read plan metadata");
        }
        if (!stepsResult.success) {
            throw new Error(stepsResult.error || "Failed to read plan steps");
        }
        if (!filesResult.success) {
            throw new Error(filesResult.error || "Failed to read plan files");
        }
        const fmtMeta = metadataResult.data;
        const fmtSteps = stepsResult.data || [];
        const fmtFiles = filesResult.data || [];
        const metadata = mapSqliteMetadata(fmtMeta, planPath);
        const steps = mapSqliteSteps(fmtSteps, planPath);
        const files = mapSqliteFiles(fmtFiles, fmtSteps);
        let state = {
            status: "pending",
            lastUpdatedAt: new Date(),
            blockers: [],
            issues: [],
            progress: 0,
        };
        if (parseStatus) {
            const statusFile = fmtFiles.find((f) => f.type === "status" || f.filename === "STATUS.md");
            if (statusFile) {
                state = parseStatusDocument(statusFile.content, steps);
            }
            else {
                state = derivePlanState(steps);
            }
        }
        return { metadata, files, steps, state };
    }
    finally {
        await provider.close();
    }
}
function mapSqliteMetadata(fmt, planPath) {
    return {
        code: fmt.id,
        name: fmt.name,
        description: fmt.description,
        path: planPath,
    };
}
function mapSqliteSteps(fmtSteps, planPath) {
    return fmtSteps.map((s) => {
        const stepNum = String(s.number).padStart(2, "0");
        const filename = `${stepNum}-${s.code}.md`;
        const dependencies = parseDependenciesFromContent(s.content);
        return {
            number: s.number,
            code: s.code,
            filename,
            title: s.title,
            description: s.description,
            status: s.status,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
            completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
            filePath: join(planPath, "plan", filename),
        };
    });
}
function mapSqliteFiles(fmtFiles, fmtSteps) {
    const files = {
        steps: fmtSteps.map((s) => {
            const stepNum = String(s.number).padStart(2, "0");
            return `${stepNum}-${s.code}.md`;
        }),
        subdirectories: [],
    };
    for (const f of fmtFiles) {
        if (f.filename === "SUMMARY.md" || f.type === "summary") {
            files.summary = "SUMMARY.md";
        }
        else if (f.filename === "STATUS.md" || f.type === "status") {
            files.status = "STATUS.md";
        }
        else if (f.filename === "EXECUTION_PLAN.md" || f.type === "execution_plan") {
            files.executionPlan = "EXECUTION_PLAN.md";
        }
        else if (f.type === "evidence") {
            files.evidenceDir = files.evidenceDir || "evidence";
            files.evidenceFiles = files.evidenceFiles || [];
            files.evidenceFiles.push(f.filename);
        }
        else if (f.type === "feedback") {
            files.feedbackDir = files.feedbackDir || "feedback";
            files.feedbackFiles = files.feedbackFiles || [];
            files.feedbackFiles.push(f.filename);
        }
    }
    return files;
}
function derivePlanState(steps) {
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const currentStep = steps.find((s) => s.status === "in_progress");
    const completedNumbers = steps
        .filter((s) => s.status === "completed")
        .map((s) => s.number);
    let status = "pending";
    if (completedSteps === steps.length && steps.length > 0) {
        status = "completed";
    }
    else if (currentStep || completedSteps > 0) {
        status = "in_progress";
    }
    return {
        status,
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0,
        currentStep: currentStep?.number,
        lastCompletedStep: completedNumbers.length > 0 ? Math.max(...completedNumbers) : undefined,
    };
}
// ===== STATUS PARSING =====
const STATUS_EMOJIS = ["⬜", "🔄", "✅", "❌", "⏸️", "⏭️"];
function findStatusEmoji(text) {
    for (const emoji of STATUS_EMOJIS) {
        if (text.includes(emoji)) {
            return emoji;
        }
    }
    return null;
}
/**
 * Parse STATUS.md content into PlanState
 */
function parseStatusDocument(content, steps) {
    const state = {
        status: "pending",
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 0,
    };
    const statusRowMatch = content.match(/\*\*Status\*\*\s*\|\s*([^|]+)/i);
    if (statusRowMatch) {
        const emoji = findStatusEmoji(statusRowMatch[1]);
        if (emoji) {
            const statusFromEmoji = PLAN_CONVENTIONS.emojiToStatus[emoji];
            if (statusFromEmoji) {
                state.status = statusFromEmoji;
            }
        }
    }
    const lines = content.split("\n");
    for (const line of lines) {
        const stepMatch = line.match(/^\|\s*(\d{2})\s*\|[^|]+\|([^|]+)\|/);
        if (stepMatch) {
            const stepNum = parseInt(stepMatch[1]);
            const statusCell = stepMatch[2];
            const emoji = findStatusEmoji(statusCell);
            if (emoji) {
                const status = PLAN_CONVENTIONS.emojiToStatus[emoji];
                if (status) {
                    const step = steps.find((s) => s.number === stepNum);
                    if (step) {
                        step.status = status;
                    }
                }
            }
        }
    }
    const completedSteps = steps.filter(
        (s) => s.status === "completed" || s.status === "skipped"
    ).length;
    state.progress =
        steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
    const currentStep = steps.find((s) => s.status === "in_progress");
    if (currentStep) {
        state.currentStep = currentStep.number;
    }
    const completedStepNumbers = steps
        .filter((s) => s.status === "completed" || s.status === "skipped")
        .map((s) => s.number);
    if (completedStepNumbers.length > 0) {
        state.lastCompletedStep = Math.max(...completedStepNumbers);
    }
    // Header row may be plain text (e.g. SQLite-generated STATUS) with no emoji; step rows
    // from SQLite still carry authoritative task status.
    if (completedSteps === steps.length && steps.length > 0) {
        state.status = "completed";
    } else if (currentStep || completedSteps > 0) {
        state.status = "in_progress";
    }
    return state;
}
//# sourceMappingURL=loader.js.map