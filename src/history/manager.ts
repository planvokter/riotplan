/**
 * History Manager
 *
 * Manage plan history storage. Supports both directory-based plans
 * (.history/HISTORY.json) and SQLite .plan files.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { PlanHistory } from "../types.js";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";

/**
 * History manager interface
 */
export interface HistoryManager {
  /** History data */
  history: PlanHistory;

  /** Path to history file or .plan file */
  path: string;

  /** Save history to disk */
  save(): Promise<void>;

  /** Reload history from disk */
  reload(): Promise<void>;
}

const HISTORY_FILE = ".history/HISTORY.json";

/**
 * Initialize a new history for a plan
 */
export function initHistory(initialVersion = "0.1"): PlanHistory {
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

/**
 * Load history from a plan directory or .plan SQLite file
 */
export async function loadHistory(planPath: string): Promise<HistoryManager> {
    if (planPath.endsWith(".plan")) {
        return loadHistoryFromSqlite(planPath);
    }

    return loadHistoryFromDirectory(planPath);
}

/**
 * Save history for a plan directory or .plan SQLite file
 */
export async function saveHistory(
    history: PlanHistory,
    planPath: string,
): Promise<void> {
    if (planPath.endsWith(".plan")) {
        return saveHistoryToSqlite(history, planPath);
    }

    return saveHistoryToDirectory(history, planPath);
}

// ===== SQLITE =====

async function loadHistoryFromSqlite(planPath: string): Promise<HistoryManager> {
    let history: PlanHistory;

    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getFile("other", HISTORY_FILE);
        if (result.success && result.data) {
            const data = JSON.parse(result.data.content);
            history = parseHistoryDates(data);
        } else {
            history = initHistory();
        }
    } catch {
        history = initHistory();
    } finally {
        await provider.close();
    }

    return createHistoryManager(history, planPath, planPath);
}

async function saveHistoryToSqlite(history: PlanHistory, planPath: string): Promise<void> {
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
    } finally {
        await provider.close();
    }
}

// ===== DIRECTORY =====

async function loadHistoryFromDirectory(planPath: string): Promise<HistoryManager> {
    const historyPath = join(planPath, HISTORY_FILE);
    let history: PlanHistory;

    try {
        const content = await readFile(historyPath, "utf-8");
        const data = JSON.parse(content);
        history = parseHistoryDates(data);
    } catch {
        history = initHistory();
    }

    return createHistoryManager(history, historyPath, planPath);
}

async function saveHistoryToDirectory(history: PlanHistory, planPath: string): Promise<void> {
    const historyPath = join(planPath, HISTORY_FILE);
    await mkdir(dirname(historyPath), { recursive: true });
    const data = serializeHistory(history);
    await writeFile(historyPath, JSON.stringify(data, null, 2), "utf-8");
}

// ===== SHARED =====

function parseHistoryDates(data: Record<string, unknown>): PlanHistory {
    const revisions = data.revisions as Array<Record<string, unknown>> | undefined;
    const milestones = data.milestones as Array<Record<string, unknown>> | undefined;

    return {
        ...data,
        revisions: (revisions || []).map((r) => ({
            ...r,
            createdAt: new Date(r.createdAt as string),
        })),
        milestones: milestones?.map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt as string),
        })),
    } as PlanHistory;
}

function serializeHistory(history: PlanHistory): Record<string, unknown> {
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

function createHistoryManager(
    history: PlanHistory,
    path: string,
    planPath?: string,
): HistoryManager {
    const resolvedPlanPath = planPath || dirname(dirname(path));

    return {
        history,
        path,
        async save() {
            await saveHistory(history, resolvedPlanPath);
        },
        async reload() {
            const reloaded = await loadHistory(resolvedPlanPath);
            Object.assign(history, reloaded.history);
        },
    };
}
