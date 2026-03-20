/**
 * STATUS.md Parser Module
 *
 * Parses STATUS.md files into structured PlanState and StatusDocument objects.
 * Handles various format variations and provides warnings for parsing issues.
 */
import { PLAN_CONVENTIONS } from "../types.js";
// ===== MAIN EXPORT =====
/**
 * Parse STATUS.md content into structured data
 *
 * @param content - The STATUS.md file content
 * @param options - Parsing options
 * @returns Parsed document, state, and any warnings
 *
 * @example
 * ```typescript
 * const content = await readFile('STATUS.md', 'utf-8');
 * const result = parseStatus(content);
 * console.log(result.state.progress); // 40
 * console.log(result.document.stepProgress.length); // 5
 * ```
 */
export function parseStatus(content, options = {}) {
    const warnings = [];
    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Unknown Plan";
    // Parse sections
    const currentState = parseCurrentState(content);
    const stepProgress = parseStepProgress(content);
    const blockers = parseBlockers(content);
    const issues = parseIssues(content);
    const notes = parseNotes(content);
    // Build document
    const document = {
        title,
        currentState,
        stepProgress,
        blockers,
        issues,
        notes,
    };
    // Calculate progress
    const completedSteps = stepProgress.filter((s) => s.status === "completed").length;
    const progress = stepProgress.length > 0
        ? Math.round((completedSteps / stepProgress.length) * 100)
        : 0;
    // Build state
    const state = {
        status: currentState.status,
        lastUpdatedAt: currentState.lastUpdated
            ? new Date(currentState.lastUpdated)
            : new Date(),
        blockers: blockers.map((desc, i) => ({
            id: `blocker-${i + 1}`,
            description: desc,
            severity: "medium",
            affectedSteps: [],
            createdAt: new Date(),
        })),
        issues: issues.map((desc, i) => ({
            id: `issue-${i + 1}`,
            title: desc.substring(0, 50),
            description: desc,
            severity: "medium",
            createdAt: new Date(),
        })),
        progress,
    };
    // Set started date if available
    if (currentState.startedAt) {
        state.startedAt = new Date(currentState.startedAt);
    }
    // Cross-reference with steps if provided
    if (options.steps) {
        const currentStepNum = extractStepNumber(currentState.currentStep);
        if (currentStepNum)
            state.currentStep = currentStepNum;
        const lastStepNum = extractStepNumber(currentState.lastCompleted);
        if (lastStepNum)
            state.lastCompletedStep = lastStepNum;
        // Validate step count
        if (stepProgress.length > 0 &&
            stepProgress.length !== options.steps.length) {
            warnings.push(`Step count mismatch: STATUS.md has ${stepProgress.length}, ` +
                `plan has ${options.steps.length}`);
        }
    }
    return { document, state, warnings };
}
// ===== CURRENT STATE PARSING =====
/**
 * Parse the Current State section
 */
function parseCurrentState(content) {
    const state = {
        status: "pending",
    };
    // Extract status from table format
    const statusMatch = content.match(/\|\s*\*\*Status\*\*\s*\|\s*([^|]+)/i);
    if (statusMatch) {
        const statusText = statusMatch[1].trim();
        const emoji = findStatusEmoji(statusText);
        if (emoji) {
            state.status = parseStatusEmoji(emoji);
        }
        else {
            state.status = parseStatusText(statusText);
        }
    }
    // Current step
    const currentMatch = content.match(/\|\s*\*\*Current Step\*\*\s*\|\s*([^|]+)/i);
    if (currentMatch && currentMatch[1].trim() !== "-") {
        state.currentStep = currentMatch[1].trim();
    }
    // Last completed
    const lastMatch = content.match(/\|\s*\*\*Last Completed\*\*\s*\|\s*([^|]+)/i);
    if (lastMatch && lastMatch[1].trim() !== "-") {
        state.lastCompleted = lastMatch[1].trim();
    }
    // Started date
    const startedMatch = content.match(/\|\s*\*\*Started\*\*\s*\|\s*([^|]+)/i);
    if (startedMatch && startedMatch[1].trim() !== "-") {
        state.startedAt = startedMatch[1].trim();
    }
    // Last updated
    const updatedMatch = content.match(/\|\s*\*\*Last Updated\*\*\s*\|\s*([^|]+)/i);
    if (updatedMatch && updatedMatch[1].trim() !== "-") {
        state.lastUpdated = updatedMatch[1].trim();
    }
    return state;
}
// Status emoji strings for matching
const STATUS_EMOJIS = ["⬜", "🔄", "✅", "❌", "⏸️", "⏭️"];
/**
 * Find a status emoji in text
 */
function findStatusEmoji(text) {
    for (const emoji of STATUS_EMOJIS) {
        if (text.includes(emoji)) {
            return emoji;
        }
    }
    return null;
}
/**
 * Parse status from emoji
 */
function parseStatusEmoji(emoji) {
    return (PLAN_CONVENTIONS.emojiToStatus[emoji] || "pending");
}
/**
 * Parse status from text
 */
function parseStatusText(text) {
    const normalized = text.toLowerCase().replace(/[^a-z_]/g, "");
    const valid = [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "blocked",
        "skipped",
    ];
    if (valid.includes(normalized)) {
        return normalized;
    }
    // Handle variations
    if (normalized.includes("progress") || normalized.includes("inprogress")) {
        return "in_progress";
    }
    if (normalized.includes("complete") || normalized.includes("done")) {
        return "completed";
    }
    if (normalized.includes("block")) {
        return "blocked";
    }
    if (normalized.includes("skip")) {
        return "skipped";
    }
    if (normalized.includes("fail") || normalized.includes("error")) {
        return "failed";
    }
    return "pending";
}
// ===== STEP PROGRESS PARSING =====
/**
 * Parse the Step Progress table
 */
function parseStepProgress(content) {
    const steps = [];
    // Find the step progress table - look for table header with Step and Name columns
    // Use line-by-line parsing to avoid polynomial regex
    const lines = content.split('\n');
    let inTable = false;
    let headerFound = false;
    const tableRows = [];
    for (const line of lines) {
        // Look for table header
        if (!headerFound && /\|\s*Step\s*\|\s*Name\s*\|/i.test(line)) {
            headerFound = true;
            continue;
        }
        // Skip separator row
        if (headerFound && !inTable && /^\|[-\s|]+\|$/.test(line)) {
            inTable = true;
            continue;
        }
        // Collect table rows
        if (inTable) {
            // Stop at empty line or new section
            if (!line.trim() || /^##/.test(line)) {
                break;
            }
            if (line.includes('|')) {
                tableRows.push(line);
            }
        }
    }
    if (tableRows.length === 0)
        return steps;
    for (const row of tableRows) {
        // Skip separator rows
        if (row.match(/^\|[-\s|]+\|$/))
            continue;
        const cells = row
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c);
        if (cells.length >= 3) {
            const step = cells[0];
            const name = cells[1];
            const statusStr = cells[2];
            const started = cells[3] || undefined;
            const completed = cells[4] || undefined;
            const notes = cells[5] || undefined;
            // Parse status from emoji or text
            const emoji = findStatusEmoji(statusStr);
            const status = emoji
                ? parseStatusEmoji(emoji)
                : parseStatusText(statusStr);
            steps.push({
                step,
                name,
                status,
                started: started && started !== "-" ? started : undefined,
                completed: completed && completed !== "-" ? completed : undefined,
                notes: notes && notes !== "-" ? notes : undefined,
            });
        }
    }
    return steps;
}
// ===== BLOCKERS/ISSUES PARSING =====
/**
 * Parse the Blockers section
 */
function parseBlockers(content) {
    const blockers = [];
    const section = extractSection(content, "Blockers");
    if (!section)
        return blockers;
    // Check for "None" indicator
    if (section.toLowerCase().includes("none")) {
        return blockers;
    }
    // Parse as list items
    const listItems = section.match(/^[-*]\s+(.+)$/gm);
    if (listItems) {
        for (const item of listItems) {
            const text = item.replace(/^[-*]\s+/, "").trim();
            if (text && !text.toLowerCase().includes("none")) {
                blockers.push(text);
            }
        }
    }
    return blockers;
}
/**
 * Parse the Issues section
 */
function parseIssues(content) {
    const issues = [];
    const section = extractSection(content, "Issues");
    if (!section)
        return issues;
    // Check for "None" indicator
    if (section.toLowerCase().includes("none")) {
        return issues;
    }
    // Parse as list items
    const listItems = section.match(/^[-*]\s+(.+)$/gm);
    if (listItems) {
        for (const item of listItems) {
            const text = item.replace(/^[-*]\s+/, "").trim();
            if (text && !text.toLowerCase().includes("none")) {
                issues.push(text);
            }
        }
    }
    return issues;
}
/**
 * Parse the Notes section
 */
function parseNotes(content) {
    const section = extractSection(content, "Notes");
    if (!section || section.trim() === "")
        return undefined;
    // Filter out common empty indicators
    const trimmed = section.trim();
    if (trimmed === "-" ||
        trimmed.toLowerCase() === "none" ||
        trimmed.toLowerCase() === "none currently.") {
        return undefined;
    }
    return trimmed;
}
/**
 * Extract a section from markdown content
 */
function extractSection(content, name) {
    // Use line-by-line parsing to avoid polynomial regex
    const lines = content.split('\n');
    const sectionLines = [];
    let inSection = false;
    for (const line of lines) {
        // Check if we're entering the target section
        if (new RegExp(`^##\\s*${name}`, 'i').test(line)) {
            inSection = true;
            continue;
        }
        // Check if we're entering a new section or separator
        if (inSection && (/^##/.test(line) || /^---/.test(line))) {
            break;
        }
        // Collect lines in the section
        if (inSection) {
            sectionLines.push(line);
        }
    }
    return sectionLines.length > 0 ? sectionLines.join('\n').trim() : undefined;
}
// ===== UTILITIES =====
/**
 * Extract step number from a step reference
 */
function extractStepNumber(stepRef) {
    if (!stepRef)
        return undefined;
    const match = stepRef.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
//# sourceMappingURL=parser.js.map