import type { Analysis, AnalysisMetadata } from "./types.js";
import { readPlanDoc } from "../artifacts/operations.js";

/**
 * Load an analysis from a .plan SQLite file
 */
export async function loadAnalysis(planPath: string): Promise<Analysis | null> {
    const reqDoc = await readPlanDoc(planPath, "other", "analysis/REQUIREMENTS.md");
    if (!reqDoc) return null;

    const philDoc = await readPlanDoc(planPath, "other", "analysis/PHILOSOPHY.md");

    const metadata: AnalysisMetadata = {
        createdAt: parseAnalysisDate(reqDoc.content, "Created") ?? new Date(),
        updatedAt: parseAnalysisDate(reqDoc.content, "Last Updated") ?? new Date(),
        elaborationCount: parseElaborationCount(reqDoc.content),
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

function parseAnalysisStatus(content: string): "draft" | "ready" | "converted" {
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
export async function hasAnalysis(planPath: string): Promise<boolean> {
    const doc = await readPlanDoc(planPath, "other", "analysis/REQUIREMENTS.md");
    return doc !== null;
}
