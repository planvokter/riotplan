/**
 * Plan Registry Module
 *
 * Tracks and discovers plans across directories and repositories:
 * - Scan directories for plans
 * - Index plan metadata for quick lookups
 * - Track plan relationships globally
 * - Support multiple search paths
 */
import type { TaskStatus } from "../types.js";
/**
 * A registered plan entry
 */
export interface RegisteredPlan {
    /** Plan code (directory name) */
    code: string;
    /** Human-readable name */
    name: string;
    /** Absolute path to plan directory */
    path: string;
    /** Overall status */
    status: TaskStatus;
    /** Progress percentage */
    progress: number;
    /** Number of steps */
    stepCount: number;
    /** Number of completed steps */
    completedSteps: number;
    /** When discovered/registered */
    registeredAt: Date;
    /** When last scanned */
    lastScannedAt: Date;
    /** Tags (if any) */
    tags?: string[];
    /** Description snippet */
    description?: string;
    /** Parent plan path (if spawned from another) */
    parentPlan?: string;
}
/**
 * Plan registry containing all discovered plans
 */
export interface PlanRegistry {
    /** Version of the registry format */
    version: string;
    /** When last updated */
    lastUpdatedAt: Date;
    /** Search paths for plan discovery */
    searchPaths: string[];
    /** All registered plans indexed by path */
    plans: Map<string, RegisteredPlan>;
    /** Index by code for quick lookup */
    byCode: Map<string, string[]>;
    /** Index by status */
    byStatus: Map<TaskStatus, string[]>;
}
/**
 * Options for creating/loading a registry
 */
export interface RegistryOptions {
    /** Search paths to scan for plans */
    searchPaths?: string[];
    /** Maximum depth to scan (default: 3) */
    maxDepth?: number;
    /** Include hidden directories (default: false) */
    includeHidden?: boolean;
    /** Directories to skip */
    excludeDirs?: string[];
}
/**
 * Result of a plan search
 */
export interface SearchResult {
    /** Matching plans */
    plans: RegisteredPlan[];
    /** Total matches */
    total: number;
}
/**
 * Options for searching plans
 */
export interface SearchOptions {
    /** Filter by status */
    status?: TaskStatus | TaskStatus[];
    /** Filter by code pattern (glob or regex) */
    codePattern?: string;
    /** Filter by name pattern */
    namePattern?: string;
    /** Filter by tag */
    tags?: string[];
    /** Minimum progress */
    minProgress?: number;
    /** Maximum progress */
    maxProgress?: number;
    /** Sort by field */
    sortBy?: "name" | "code" | "progress" | "status" | "registeredAt";
    /** Sort direction */
    sortDir?: "asc" | "desc";
    /** Limit results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
/**
 * Get the default registry path
 */
export declare function getDefaultRegistryPath(): string;
/**
 * Create a new empty registry
 */
export declare function createRegistry(searchPaths?: string[]): PlanRegistry;
/**
 * Load registry from file
 *
 * @param path - Path to registry file (defaults to home directory)
 */
export declare function loadRegistry(path?: string): Promise<PlanRegistry | null>;
/**
 * Save registry to file
 *
 * @param registry - The registry to save
 * @param path - Path to save to (defaults to home directory)
 */
export declare function saveRegistry(registry: PlanRegistry, path?: string): Promise<void>;
/**
 * Scan directories for plans and add them to registry
 *
 * @param registry - The registry to update
 * @param options - Scan options
 */
export declare function scanForPlans(registry: PlanRegistry, options?: RegistryOptions): Promise<number>;
/**
 * Register a plan in the registry
 */
export declare function registerPlan(registry: PlanRegistry, entry: RegisteredPlan): void;
/**
 * Unregister a plan from the registry
 */
export declare function unregisterPlan(registry: PlanRegistry, path: string): boolean;
/**
 * Refresh a single plan's entry
 *
 * @param registry - The registry
 * @param path - Path to the plan
 * @returns Updated entry or null if plan no longer exists
 */
export declare function refreshPlan(registry: PlanRegistry, path: string): Promise<RegisteredPlan | null>;
/**
 * Refresh all plans in the registry
 */
export declare function refreshAllPlans(registry: PlanRegistry): Promise<{
    updated: number;
    removed: number;
}>;
/**
 * Search for plans in the registry
 */
export declare function searchPlans(registry: PlanRegistry, options?: SearchOptions): SearchResult;
/**
 * Get a plan by code
 */
export declare function getPlanByCode(registry: PlanRegistry, code: string): RegisteredPlan | null;
/**
 * Get a plan by path
 */
export declare function getPlanByPath(registry: PlanRegistry, path: string): RegisteredPlan | null;
/**
 * Get all plans with a specific status
 */
export declare function getPlansByStatus(registry: PlanRegistry, status: TaskStatus): RegisteredPlan[];
/**
 * Get registry statistics
 */
export interface RegistryStats {
    totalPlans: number;
    byStatus: Record<TaskStatus, number>;
    averageProgress: number;
    oldestPlan?: RegisteredPlan;
    newestPlan?: RegisteredPlan;
    searchPathCount: number;
}
/**
 * Get statistics about the registry
 */
export declare function getRegistryStats(registry: PlanRegistry): RegistryStats;
//# sourceMappingURL=index.d.ts.map