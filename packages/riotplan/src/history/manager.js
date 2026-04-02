/**
 * History Manager
 *
 * Manage plan history storage via SQLite .plan files.
 */
import { createSqliteProvider } from "@planvokter/riotplan-format";
const HISTORY_FILE = ".history/HISTORY.json";
export function initHistory(initialVersion = "0.1") {
    return {
        revisions: [
            {
                version: initialVersion,
                createdAt: new Date(),
                message: "Initial version",
            },
        ],
        currentVersion: initialVersion,
        milestones: [],
    };
}
export async function loadHistory(planPath) {
    let history;
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getFile("other", HISTORY_FILE);
        if (result.success && result.data) {
            const data = JSON.parse(result.data.content);
            history = parseHistoryDates(data);
        }
        else {
            history = initHistory();
        }
    }
    catch {
        history = initHistory();
    }
    finally {
        await provider.close();
    }
    return createHistoryManager(history, planPath);
}
export async function saveHistory(history, planPath) {
    const data = serializeHistory(history);
    const now = new Date().toISOString();
    const provider = createSqliteProvider(planPath);
    try {
        await provider.saveFile({
            type: "other",
            filename: HISTORY_FILE,
            content: JSON.stringify(data, null, 2),
            createdAt: now,
            updatedAt: now,
        });
    }
    finally {
        await provider.close();
    }
}
function parseHistoryDates(data) {
    const revisions = data.revisions;
    const milestones = data.milestones;
    return {
        ...data,
        revisions: (revisions || []).map((r) => ({
            ...r,
            createdAt: new Date(r.createdAt),
        })),
        milestones: milestones?.map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt),
        })),
    };
}
function serializeHistory(history) {
    return {
        ...history,
        revisions: history.revisions.map((r) => ({
            ...r,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        })),
        milestones: history.milestones?.map((m) => ({
            ...m,
            createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
        })),
    };
}
function createHistoryManager(history, planPath) {
    return {
        history,
        path: planPath,
        async save() {
            await saveHistory(history, planPath);
        },
        async reload() {
            const reloaded = await loadHistory(planPath);
            Object.assign(history, reloaded.history);
        },
    };
}
//# sourceMappingURL=manager.js.map