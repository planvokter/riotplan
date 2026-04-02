import { createSqliteProvider } from "@planvokter/riotplan-format";

export interface SqliteStatusStep {
    number: number;
    title: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
}

export interface SqliteStatusSnapshot {
    planId: string;
    name: string;
    status: string;
    lastCompleted?: number;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    blockers: unknown[];
    issues: unknown[];
    lastUpdated: string;
    steps?: SqliteStatusStep[];
}

export async function readSqliteStatusSnapshot(
    planPath: string,
    verbose?: boolean
): Promise<SqliteStatusSnapshot> {
    const provider = createSqliteProvider(planPath);
    try {
        const exists = await provider.exists();
        if (!exists) {
            throw new Error(`Plan not found: ${planPath}`);
        }

        const [metaResult, stepsResult] = await Promise.all([
            provider.getMetadata(),
            provider.getSteps(),
        ]);
        if (!metaResult.success || !metaResult.data) {
            throw new Error(metaResult.error || "Failed to read plan metadata");
        }

        const steps = stepsResult.success ? stepsResult.data || [] : [];
        const completed = steps.filter(
            (s) => s.status === "completed" || s.status === "skipped"
        ).length;
        const total = steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const lastCompleted = steps
            .filter((s) => s.status === "completed" || s.status === "skipped")
            .map((s) => s.number)
            .sort((a, b) => b - a)[0];
        const inProgress = steps.find((s) => s.status === "in_progress");

        let status: string;
        if (steps.length === 0) {
            status =
                metaResult.data.stage === "completed" || metaResult.data.stage === "cancelled"
                    ? metaResult.data.stage
                    : "pending";
        } else if (inProgress) {
            status = "in_progress";
        } else if (steps.some((s) => s.status === "pending")) {
            status = "pending";
        } else {
            status = "completed";
        }

        const mappedSteps = verbose
            ? steps.map((s) => ({
                number: s.number,
                title: s.title,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            }))
            : undefined;

        return {
            planId: metaResult.data.id,
            name: metaResult.data.name,
            status,
            lastCompleted,
            progress: {
                completed,
                total,
                percentage,
            },
            blockers: [],
            issues: [],
            lastUpdated: metaResult.data.updatedAt,
            steps: mappedSteps,
        };
    } finally {
        await provider.close();
    }
}
