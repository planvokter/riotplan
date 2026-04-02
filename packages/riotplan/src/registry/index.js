/**
 * Plan Registry Module
 *
 * Tracks and discovers plans across directories and repositories:
 * - Scan directories for plans
 * - Index plan metadata for quick lookups
 * - Track plan relationships globally
 * - Support multiple search paths
 */
import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { loadPlan } from "../plan/loader.js";
// ===== REGISTRY FILE =====
const REGISTRY_FILENAME = ".riotplan-registry.json";
const REGISTRY_VERSION = "1.0";
/**
 * Get the default registry path
 */
export function getDefaultRegistryPath() {
    return join(homedir(), REGISTRY_FILENAME);
}
// ===== REGISTRY CREATION =====
/**
 * Create a new empty registry
 */
export function createRegistry(searchPaths = []) {
    return {
        version: REGISTRY_VERSION,
        lastUpdatedAt: new Date(),
        searchPaths: searchPaths.map((p) => resolve(p)),
        plans: new Map(),
        byCode: new Map(),
        byStatus: new Map(),
    };
}
/**
 * Load registry from file
 *
 * @param path - Path to registry file (defaults to home directory)
 */
export async function loadRegistry(path) {
    const registryPath = path || getDefaultRegistryPath();
    try {
        await access(registryPath);
        const content = await readFile(registryPath, "utf-8");
        const data = JSON.parse(content);
        // Convert JSON back to registry structure
        const registry = createRegistry(data.searchPaths || []);
        registry.version = data.version || REGISTRY_VERSION;
        registry.lastUpdatedAt = new Date(data.lastUpdatedAt);
        // Restore plans
        if (data.plans && Array.isArray(data.plans)) {
            for (const plan of data.plans) {
                const entry = {
                    ...plan,
                    registeredAt: new Date(plan.registeredAt),
                    lastScannedAt: new Date(plan.lastScannedAt),
                };
                registry.plans.set(entry.path, entry);
                indexPlan(registry, entry);
            }
        }
        return registry;
    }
    catch {
        return null;
    }
}
/**
 * Save registry to file
 *
 * @param registry - The registry to save
 * @param path - Path to save to (defaults to home directory)
 */
export async function saveRegistry(registry, path) {
    const registryPath = path || getDefaultRegistryPath();
    registry.lastUpdatedAt = new Date();
    const data = {
        version: registry.version,
        lastUpdatedAt: registry.lastUpdatedAt.toISOString(),
        searchPaths: registry.searchPaths,
        plans: Array.from(registry.plans.values()).map((plan) => ({
            ...plan,
            registeredAt: plan.registeredAt.toISOString(),
            lastScannedAt: plan.lastScannedAt.toISOString(),
        })),
    };
    await writeFile(registryPath, JSON.stringify(data, null, 2));
}
// ===== PLAN DISCOVERY =====
/**
 * Scan directories for plans and add them to registry
 *
 * @param registry - The registry to update
 * @param options - Scan options
 */
export async function scanForPlans(registry, options = {}) {
    const { searchPaths = registry.searchPaths, maxDepth = 3, includeHidden = false, excludeDirs = ["node_modules", ".git", "dist", "coverage"], } = options;
    let discovered = 0;
    for (const searchPath of searchPaths) {
        const absolutePath = resolve(searchPath);
        try {
            discovered += await scanDirectory(registry, absolutePath, 0, maxDepth, includeHidden, excludeDirs);
        }
        catch {
            // Skip inaccessible paths
        }
    }
    // Update search paths
    for (const path of searchPaths) {
        const absolutePath = resolve(path);
        if (!registry.searchPaths.includes(absolutePath)) {
            registry.searchPaths.push(absolutePath);
        }
    }
    registry.lastUpdatedAt = new Date();
    return discovered;
}
/**
 * Recursively scan a directory for .plan SQLite files
 */
async function scanDirectory(registry, dirPath, depth, maxDepth, includeHidden, excludeDirs) {
    if (depth > maxDepth)
        return 0;
    let discovered = 0;
    const dirName = basename(dirPath);
    if (excludeDirs.includes(dirName))
        return 0;
    if (!includeHidden && dirName.startsWith("."))
        return 0;
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = join(dirPath, entry.name);
                discovered += await scanDirectory(registry, subPath, depth + 1, maxDepth, includeHidden, excludeDirs);
            }
            else if (entry.isFile() && entry.name.endsWith(".plan")) {
                const planFilePath = join(dirPath, entry.name);
                try {
                    const planEntry = await createPlanEntry(planFilePath);
                    registerPlan(registry, planEntry);
                    discovered++;
                }
                catch {
                    // Skip .plan files that can't be loaded
                }
            }
        }
    }
    catch {
        // Can't read directory
    }
    return discovered;
}
/**
 * Create a registry entry from a plan directory
 */
async function createPlanEntry(planPath) {
    const plan = await loadPlan(planPath);
    const now = new Date();
    return {
        code: plan.metadata.code,
        name: plan.metadata.name,
        path: planPath,
        status: plan.state.status,
        progress: plan.state.progress,
        stepCount: plan.steps.length,
        completedSteps: plan.steps.filter((s) => s.status === "completed")
            .length,
        registeredAt: now,
        lastScannedAt: now,
        tags: plan.metadata.tags,
        description: plan.metadata.description?.slice(0, 200),
        parentPlan: plan.relationships?.find((r) => r.type === "spawned-from")
            ?.planPath,
    };
}
// ===== PLAN REGISTRATION =====
/**
 * Register a plan in the registry
 */
export function registerPlan(registry, entry) {
    // Remove old entry if exists
    const existing = registry.plans.get(entry.path);
    if (existing) {
        removeFromIndex(registry, existing);
    }
    // Add new entry
    registry.plans.set(entry.path, entry);
    indexPlan(registry, entry);
}
/**
 * Unregister a plan from the registry
 */
export function unregisterPlan(registry, path) {
    const entry = registry.plans.get(path);
    if (!entry)
        return false;
    removeFromIndex(registry, entry);
    registry.plans.delete(path);
    return true;
}
/**
 * Add plan to indexes
 */
function indexPlan(registry, entry) {
    // Index by code
    const codePaths = registry.byCode.get(entry.code) || [];
    if (!codePaths.includes(entry.path)) {
        codePaths.push(entry.path);
        registry.byCode.set(entry.code, codePaths);
    }
    // Index by status
    const statusPaths = registry.byStatus.get(entry.status) || [];
    if (!statusPaths.includes(entry.path)) {
        statusPaths.push(entry.path);
        registry.byStatus.set(entry.status, statusPaths);
    }
}
/**
 * Remove plan from indexes
 */
function removeFromIndex(registry, entry) {
    // Remove from code index
    const codePaths = registry.byCode.get(entry.code);
    if (codePaths) {
        const idx = codePaths.indexOf(entry.path);
        if (idx !== -1) {
            codePaths.splice(idx, 1);
            if (codePaths.length === 0) {
                registry.byCode.delete(entry.code);
            }
        }
    }
    // Remove from status index
    const statusPaths = registry.byStatus.get(entry.status);
    if (statusPaths) {
        const idx = statusPaths.indexOf(entry.path);
        if (idx !== -1) {
            statusPaths.splice(idx, 1);
            if (statusPaths.length === 0) {
                registry.byStatus.delete(entry.status);
            }
        }
    }
}
// ===== PLAN REFRESH =====
/**
 * Refresh a single plan's entry
 *
 * @param registry - The registry
 * @param path - Path to the plan
 * @returns Updated entry or null if plan no longer exists
 */
export async function refreshPlan(registry, path) {
    const existing = registry.plans.get(path);
    try {
        const entry = await createPlanEntry(path);
        // Preserve original registration date
        if (existing) {
            entry.registeredAt = existing.registeredAt;
        }
        registerPlan(registry, entry);
        return entry;
    }
    catch {
        // Plan no longer valid
        if (existing) {
            unregisterPlan(registry, path);
        }
        return null;
    }
}
/**
 * Refresh all plans in the registry
 */
export async function refreshAllPlans(registry) {
    let updated = 0;
    let removed = 0;
    const paths = Array.from(registry.plans.keys());
    for (const path of paths) {
        const result = await refreshPlan(registry, path);
        if (result) {
            updated++;
        }
        else {
            removed++;
        }
    }
    registry.lastUpdatedAt = new Date();
    return { updated, removed };
}
// ===== SEARCH AND QUERY =====
/**
 * Search for plans in the registry
 */
export function searchPlans(registry, options = {}) {
    let results = Array.from(registry.plans.values());
    // Filter by status
    if (options.status) {
        const statuses = Array.isArray(options.status)
            ? options.status
            : [options.status];
        results = results.filter((p) => statuses.includes(p.status));
    }
    // Filter by code pattern
    if (options.codePattern) {
        const pattern = new RegExp(options.codePattern, "i");
        results = results.filter((p) => pattern.test(p.code));
    }
    // Filter by name pattern
    if (options.namePattern) {
        const pattern = new RegExp(options.namePattern, "i");
        results = results.filter((p) => pattern.test(p.name));
    }
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
        results = results.filter((p) => options.tags.some((tag) => p.tags?.includes(tag)));
    }
    // Filter by progress range
    if (options.minProgress !== undefined) {
        results = results.filter((p) => p.progress >= options.minProgress);
    }
    if (options.maxProgress !== undefined) {
        results = results.filter((p) => p.progress <= options.maxProgress);
    }
    // Sort
    if (options.sortBy) {
        const dir = options.sortDir === "desc" ? -1 : 1;
        results.sort((a, b) => {
            const aVal = a[options.sortBy];
            const bVal = b[options.sortBy];
            if (aVal === undefined || aVal === null)
                return 1 * dir;
            if (bVal === undefined || bVal === null)
                return -1 * dir;
            if (typeof aVal === "string" && typeof bVal === "string") {
                return aVal.localeCompare(bVal) * dir;
            }
            if (typeof aVal === "number" && typeof bVal === "number") {
                return (aVal - bVal) * dir;
            }
            if (aVal instanceof Date && bVal instanceof Date) {
                return (aVal.getTime() - bVal.getTime()) * dir;
            }
            return 0;
        });
    }
    const total = results.length;
    // Pagination
    if (options.offset !== undefined) {
        results = results.slice(options.offset);
    }
    if (options.limit !== undefined) {
        results = results.slice(0, options.limit);
    }
    return { plans: results, total };
}
/**
 * Get a plan by code
 */
export function getPlanByCode(registry, code) {
    const paths = registry.byCode.get(code);
    if (!paths || paths.length === 0)
        return null;
    return registry.plans.get(paths[0]) || null;
}
/**
 * Get a plan by path
 */
export function getPlanByPath(registry, path) {
    return registry.plans.get(resolve(path)) || null;
}
/**
 * Get all plans with a specific status
 */
export function getPlansByStatus(registry, status) {
    const paths = registry.byStatus.get(status) || [];
    return paths
        .map((p) => registry.plans.get(p))
        .filter((p) => p !== undefined);
}
/**
 * Get statistics about the registry
 */
export function getRegistryStats(registry) {
    const plans = Array.from(registry.plans.values());
    const byStatus = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
    };
    for (const plan of plans) {
        byStatus[plan.status]++;
    }
    const totalProgress = plans.reduce((sum, p) => sum + p.progress, 0);
    const averageProgress = plans.length > 0 ? Math.round(totalProgress / plans.length) : 0;
    const sortedByDate = [...plans].sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
    return {
        totalPlans: plans.length,
        byStatus,
        averageProgress,
        oldestPlan: sortedByDate[0],
        newestPlan: sortedByDate[sortedByDate.length - 1],
        searchPathCount: registry.searchPaths.length,
    };
}
//# sourceMappingURL=index.js.map