/**
 * Dependencies Module
 *
 * Provides dependency tracking and analysis for plan steps:
 * - Parse dependencies from step markdown files
 * - Build dependency graphs
 * - Detect circular dependencies
 * - Compute critical path
 * - Determine execution order
 */
import { readFile } from "node:fs/promises";
// ===== PARSING =====
/**
 * Parse dependencies from step content
 *
 * Looks for dependency declarations in the markdown:
 * - `## Dependencies` section with bullet points
 * - `depends-on: 1, 2, 3` in frontmatter
 * - Inline references like `(depends on Step 01)`
 *
 * @param content - Step file content
 * @returns Array of step numbers this step depends on
 */
export function parseDependenciesFromContent(content) {
    const dependencies = new Set();
    // Parse frontmatter depends-on
    // Extract frontmatter first to avoid polynomial regex
    const frontmatterEnd = content.indexOf('---', 4);
    if (content.startsWith('---\n') && frontmatterEnd > 0) {
        const frontmatter = content.substring(4, frontmatterEnd);
        const dependsOnMatch = frontmatter.match(/depends-on:\s*([^\n]+)/);
        if (dependsOnMatch) {
            const nums = dependsOnMatch[1].match(/\d+/g);
            if (nums) {
                nums.forEach((n) => dependencies.add(parseInt(n)));
            }
        }
    }
    // Parse ## Dependencies section
    // Use line-by-line parsing to avoid polynomial regex
    const lines = content.split('\n');
    const sectionLines = [];
    let inSection = false;
    for (const line of lines) {
        if (/^##\s+Dependencies$/i.test(line)) {
            inSection = true;
            continue;
        }
        if (inSection && /^#/.test(line)) {
            break;
        }
        if (inSection) {
            sectionLines.push(line);
        }
    }
    if (sectionLines.length > 0) {
        const section = sectionLines.join('\n');
        // Look for bullet points with step references
        const bulletMatches = section.matchAll(/[-*]\s*(?:Step\s*)?(\d+)/gi);
        for (const match of bulletMatches) {
            dependencies.add(parseInt(match[1]));
        }
        // Look for "Step XX" references
        const stepRefs = section.matchAll(/Step\s+(\d+)/gi);
        for (const match of stepRefs) {
            dependencies.add(parseInt(match[1]));
        }
    }
    // Parse inline dependency references
    const inlineMatches = content.matchAll(/\(depends\s+on\s+(?:Step\s*)?(\d+(?:\s*,\s*\d+)*)\)/gi);
    for (const match of inlineMatches) {
        const nums = match[1].match(/\d+/g);
        if (nums) {
            nums.forEach((n) => dependencies.add(parseInt(n)));
        }
    }
    // Parse "Requires: Step X" format - capture all step references on the line
    const requiresMatches = content.matchAll(/Requires:\s*(.+?)(?:\n|$)/gi);
    for (const match of requiresMatches) {
        const lineContent = match[1];
        // Find all numbers in the line, whether preceded by "Step" or not
        const nums = lineContent.match(/\d+/g);
        if (nums) {
            nums.forEach((n) => dependencies.add(parseInt(n)));
        }
    }
    return Array.from(dependencies).sort((a, b) => a - b);
}
/**
 * Parse dependencies from a step file
 *
 * @param filePath - Path to step file
 * @returns Array of step numbers this step depends on
 */
export async function parseDependenciesFromFile(filePath) {
    const content = await readFile(filePath, "utf-8");
    return parseDependenciesFromContent(content);
}
/**
 * Parse all dependencies from a plan
 *
 * @param plan - The plan to analyze
 * @returns Map of step number to its dependencies
 */
export async function parseAllDependencies(plan) {
    const dependencies = new Map();
    for (const step of plan.steps) {
        if (step.dependencies && step.dependencies.length > 0) {
            dependencies.set(step.number, step.dependencies);
        }
        else {
            try {
                const deps = await parseDependenciesFromFile(step.filePath);
                dependencies.set(step.number, deps);
            }
            catch {
                dependencies.set(step.number, []);
            }
        }
    }
    return dependencies;
}
// ===== GRAPH BUILDING =====
/**
 * Build a dependency graph from a plan
 *
 * @param plan - The plan to analyze
 * @returns Dependency graph
 */
export async function buildDependencyGraph(plan) {
    const rawDeps = await parseAllDependencies(plan);
    return buildDependencyGraphFromMap(plan, rawDeps);
}
/**
 * Build a dependency graph from a pre-parsed dependency map
 *
 * @param plan - The plan
 * @param rawDeps - Map of step number to dependencies
 * @returns Dependency graph
 */
export function buildDependencyGraphFromMap(plan, rawDeps) {
    const stepNumbers = new Set(plan.steps.map((s) => s.number));
    const dependencies = new Map();
    // Initialize all steps
    for (const step of plan.steps) {
        dependencies.set(step.number, {
            stepNumber: step.number,
            dependsOn: [],
            blockedBy: [],
        });
    }
    // Build forward dependencies (dependsOn)
    for (const [stepNumber, deps] of rawDeps) {
        const stepDep = dependencies.get(stepNumber);
        if (stepDep) {
            // Filter to only valid steps
            stepDep.dependsOn = deps.filter((d) => stepNumbers.has(d));
        }
    }
    // Build reverse dependencies (blockedBy)
    for (const [stepNumber, stepDep] of dependencies) {
        for (const depNum of stepDep.dependsOn) {
            const depStep = dependencies.get(depNum);
            if (depStep) {
                depStep.blockedBy.push(stepNumber);
            }
        }
    }
    // Find roots (no dependencies)
    const roots = Array.from(dependencies.values())
        .filter((d) => d.dependsOn.length === 0)
        .map((d) => d.stepNumber)
        .sort((a, b) => a - b);
    // Find leaves (no dependents)
    const leaves = Array.from(dependencies.values())
        .filter((d) => d.blockedBy.length === 0)
        .map((d) => d.stepNumber)
        .sort((a, b) => a - b);
    // Detect circular dependencies
    const circularChains = detectCircularDependencies(dependencies);
    return {
        dependencies,
        roots,
        leaves,
        hasCircular: circularChains.length > 0,
        circularChains,
    };
}
/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(dependencies) {
    const circular = [];
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    function dfs(node) {
        if (recursionStack.has(node)) {
            // Found a cycle - extract the cycle from path
            const cycleStart = path.indexOf(node);
            if (cycleStart !== -1) {
                circular.push([...path.slice(cycleStart), node]);
            }
            return true;
        }
        if (visited.has(node)) {
            return false;
        }
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        const stepDep = dependencies.get(node);
        if (stepDep) {
            for (const dep of stepDep.dependsOn) {
                dfs(dep);
            }
        }
        path.pop();
        recursionStack.delete(node);
        return false;
    }
    // Start DFS from each node
    for (const node of dependencies.keys()) {
        visited.clear();
        recursionStack.clear();
        path.length = 0;
        dfs(node);
    }
    // Deduplicate cycles (same cycle can be found from different starting points)
    const uniqueCycles = [];
    const seenCycles = new Set();
    for (const cycle of circular) {
        // Normalize the cycle by rotating to start with smallest element
        const minIdx = cycle.indexOf(Math.min(...cycle));
        const normalized = [
            ...cycle.slice(minIdx),
            ...cycle.slice(0, minIdx),
        ];
        const key = normalized.join("-");
        if (!seenCycles.has(key)) {
            seenCycles.add(key);
            uniqueCycles.push(normalized);
        }
    }
    return uniqueCycles;
}
// ===== VALIDATION =====
/**
 * Validate dependencies in a plan
 *
 * @param plan - The plan to validate
 * @param graph - Optional pre-built dependency graph
 * @param rawDeps - Optional raw dependencies map (before filtering)
 * @returns Validation result
 */
export async function validateDependencies(plan, graph, rawDeps) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    // Get raw dependencies to check for invalid references
    const rawDependencies = rawDeps || (await parseAllDependencies(plan));
    const errors = [];
    const warnings = [];
    const stepNumbers = new Set(plan.steps.map((s) => s.number));
    // Check for circular dependencies
    for (const chain of depGraph.circularChains) {
        errors.push({
            type: "circular",
            stepNumber: chain[0],
            relatedSteps: chain,
            message: `Circular dependency detected: ${chain.map((n) => `Step ${n}`).join(" → ")}`,
        });
    }
    // Check each step's dependencies using raw dependencies (before filtering)
    for (const [stepNumber, deps] of rawDependencies) {
        // Check for self-reference
        if (deps.includes(stepNumber)) {
            errors.push({
                type: "self-reference",
                stepNumber,
                message: `Step ${stepNumber} depends on itself`,
            });
        }
        // Check for duplicate dependencies
        const seen = new Set();
        for (const dep of deps) {
            if (seen.has(dep)) {
                errors.push({
                    type: "duplicate",
                    stepNumber,
                    relatedSteps: [dep],
                    message: `Step ${stepNumber} has duplicate dependency on Step ${dep}`,
                });
            }
            seen.add(dep);
            // Check for invalid step references
            if (!stepNumbers.has(dep)) {
                errors.push({
                    type: "invalid-step",
                    stepNumber,
                    relatedSteps: [dep],
                    message: `Step ${stepNumber} depends on non-existent Step ${dep}`,
                });
            }
        }
    }
    // Check for long dependency chains (warning)
    const chainLength = calculateLongestChain(depGraph);
    if (chainLength > 5) {
        warnings.push({
            type: "long-chain",
            stepNumber: depGraph.roots[0] || 1,
            message: `Plan has a long dependency chain (${chainLength} steps). Consider parallelizing work.`,
        });
    }
    // Check for bottlenecks (steps that many others depend on)
    for (const [stepNumber, stepDep] of depGraph.dependencies) {
        if (stepDep.blockedBy.length > 3) {
            warnings.push({
                type: "bottleneck",
                stepNumber,
                message: `Step ${stepNumber} is a bottleneck (${stepDep.blockedBy.length} steps depend on it)`,
            });
        }
    }
    // Check for orphan steps (not in dependency chain but not a deliberate root)
    // This is just informational, not an error
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Calculate the longest dependency chain in the graph
 */
function calculateLongestChain(graph) {
    // Can't compute for circular graphs
    if (graph.hasCircular) {
        return 0;
    }
    const memo = new Map();
    const visiting = new Set();
    function getChainLength(node) {
        if (memo.has(node)) {
            return memo.get(node);
        }
        // Prevent infinite recursion (shouldn't happen if hasCircular is correct)
        if (visiting.has(node)) {
            return 0;
        }
        visiting.add(node);
        const stepDep = graph.dependencies.get(node);
        if (!stepDep || stepDep.dependsOn.length === 0) {
            memo.set(node, 1);
            visiting.delete(node);
            return 1;
        }
        let maxLength = 0;
        for (const dep of stepDep.dependsOn) {
            const length = getChainLength(dep);
            maxLength = Math.max(maxLength, length);
        }
        const result = maxLength + 1;
        memo.set(node, result);
        visiting.delete(node);
        return result;
    }
    let longest = 0;
    for (const node of graph.dependencies.keys()) {
        longest = Math.max(longest, getChainLength(node));
    }
    return longest;
}
// ===== CRITICAL PATH =====
/**
 * Find the critical path through the plan
 *
 * The critical path is the longest sequence of dependent steps
 * that determines the minimum time to complete the plan.
 *
 * @param plan - The plan to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns Critical path information
 */
export async function findCriticalPath(plan, graph) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    if (depGraph.hasCircular) {
        return {
            path: [],
            length: 0,
        };
    }
    // Use dynamic programming to find longest path
    const longestTo = new Map();
    // Initialize
    for (const node of depGraph.dependencies.keys()) {
        longestTo.set(node, { length: 1, prev: null });
    }
    // Process in topological order
    const order = await computeExecutionOrder(plan, depGraph);
    for (const node of order.order) {
        const stepDep = depGraph.dependencies.get(node);
        const current = longestTo.get(node);
        for (const dependent of stepDep.blockedBy) {
            const depInfo = longestTo.get(dependent);
            if (current.length + 1 > depInfo.length) {
                depInfo.length = current.length + 1;
                depInfo.prev = node;
            }
        }
    }
    // Find the longest path ending point
    let maxLength = 0;
    let endNode = null;
    for (const [node, info] of longestTo) {
        if (info.length > maxLength) {
            maxLength = info.length;
            endNode = node;
        }
    }
    // Reconstruct path
    const path = [];
    let current = endNode;
    while (current !== null) {
        path.unshift(current);
        current = longestTo.get(current)?.prev ?? null;
    }
    return {
        path,
        length: maxLength,
    };
}
// ===== EXECUTION ORDER =====
/**
 * Compute execution order that respects dependencies
 *
 * Returns both a linear order and parallel execution levels.
 *
 * @param plan - The plan to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns Execution order information
 */
export async function computeExecutionOrder(plan, graph) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    if (depGraph.hasCircular) {
        // Can't compute order with circular dependencies
        return {
            order: plan.steps.map((s) => s.number).sort((a, b) => a - b),
            levels: [plan.steps.map((s) => s.number).sort((a, b) => a - b)],
        };
    }
    // Kahn's algorithm for topological sort with level tracking
    const inDegree = new Map();
    const levels = [];
    const order = [];
    // Initialize in-degrees
    for (const [node, stepDep] of depGraph.dependencies) {
        inDegree.set(node, stepDep.dependsOn.length);
    }
    // Start with roots (in-degree 0)
    let currentLevel = [...depGraph.roots];
    currentLevel.sort((a, b) => a - b);
    while (currentLevel.length > 0) {
        levels.push([...currentLevel]);
        order.push(...currentLevel);
        const nextLevel = [];
        for (const node of currentLevel) {
            const stepDep = depGraph.dependencies.get(node);
            for (const dependent of stepDep.blockedBy) {
                const deg = inDegree.get(dependent) - 1;
                inDegree.set(dependent, deg);
                if (deg === 0) {
                    nextLevel.push(dependent);
                }
            }
        }
        currentLevel = nextLevel.sort((a, b) => a - b);
    }
    return { order, levels };
}
// ===== HELPER FUNCTIONS =====
/**
 * Get steps that can be started now (all dependencies completed)
 *
 * @param plan - The plan
 * @param graph - Optional pre-built dependency graph
 * @returns Steps ready to start
 */
export async function getReadySteps(plan, graph) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    const completedSteps = new Set(plan.steps.filter((s) => s.status === "completed").map((s) => s.number));
    const ready = [];
    for (const step of plan.steps) {
        if (step.status !== "pending")
            continue;
        const stepDep = depGraph.dependencies.get(step.number);
        if (!stepDep)
            continue;
        // Check if all dependencies are completed
        const allDepsComplete = stepDep.dependsOn.every((d) => completedSteps.has(d));
        if (allDepsComplete) {
            ready.push(step);
        }
    }
    return ready;
}
/**
 * Get steps that are blocked by a specific step
 *
 * @param plan - The plan
 * @param stepNumber - The blocking step
 * @param graph - Optional pre-built dependency graph
 * @returns Steps blocked by this step
 */
export async function getBlockedSteps(plan, stepNumber, graph) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    const stepDep = depGraph.dependencies.get(stepNumber);
    if (!stepDep)
        return [];
    return plan.steps.filter((s) => stepDep.blockedBy.includes(s.number));
}
/**
 * Get the dependency chain for a step (all transitive dependencies)
 *
 * @param plan - The plan
 * @param stepNumber - The step to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns All steps that must be completed before this step
 */
export async function getDependencyChain(plan, stepNumber, graph) {
    const depGraph = graph || (await buildDependencyGraph(plan));
    const chain = new Set();
    const visited = new Set();
    function collect(node) {
        if (visited.has(node))
            return;
        visited.add(node);
        const stepDep = depGraph.dependencies.get(node);
        if (!stepDep)
            return;
        for (const dep of stepDep.dependsOn) {
            chain.add(dep);
            collect(dep);
        }
    }
    collect(stepNumber);
    return Array.from(chain).sort((a, b) => a - b);
}
/**
 * Update step dependencies in memory
 *
 * @param step - The step to update
 * @param dependencies - New dependency list
 * @returns Updated step
 */
export function updateStepDependencies(step, dependencies) {
    return {
        ...step,
        dependencies: [...new Set(dependencies)].sort((a, b) => a - b),
    };
}
//# sourceMappingURL=index.js.map