import { readPlanDoc } from "../artifacts/operations.js";
/**
 * Load an analysis from a .plan SQLite file
 */
export async function loadAnalysis(planPath) {
    const reqDoc = await readPlanDoc(planPath, "other", "analysis/REQUIREMENTS.md");
    if (!reqDoc)
        return null;
    const philDoc = await readPlanDoc(planPath, "other", "analysis/PHILOSOPHY.md");
    const metadata = {
        createdAt: new Date(),
        updatedAt: new Date(),
        elaborationCount: 0,
        status: parseAnalysisStatus(reqDoc.content),
    };
    return {
        path: planPath,
        requirements: reqDoc.content,
        philosophy: philDoc?.content,
        elaborations: [],
        metadata,
    };
}
function parseAnalysisStatus(content) {
    const statusMatch = content.match(/\*\*Status\*\*\s*\|\s*`(\w+)`/);
    if (statusMatch) {
        const status = statusMatch[1];
        if (status === "ready" || status === "converted") {
            return status;
        }
    }
    return "draft";
}
/**
 * Check if a plan has an analysis
 */
export async function hasAnalysis(planPath) {
    const doc = await readPlanDoc(planPath, "other", "analysis/REQUIREMENTS.md");
    return doc !== null;
}
//# sourceMappingURL=loader.js.map