/**
 * Plan Loader Module
 *
 * Loads plan directories into Plan data structures.
 * Discovers and parses all standard files, steps, feedback, and evidence.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import type {
    Plan,
    PlanFiles,
    PlanMetadata,
    PlanStep,
    PlanState,
    FeedbackRecord,
    FeedbackParticipant,
    FeedbackPlatform,
    EvidenceRecord,
    EvidenceType,
} from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";
import { parseDependenciesFromContent } from "../dependencies/index.js";
import { readPlanManifestMetadata } from "./manifest.js";

// ===== OPTIONS =====

/**
 * Options for loading a plan
 */
export interface LoadPlanOptions {
    /** Include feedback records (default: true) */
    includeFeedback?: boolean;

    /** Include evidence files (default: true) */
    includeEvidence?: boolean;

    /** Parse STATUS.md for state (default: true) */
    parseStatus?: boolean;
}

// ===== MAIN EXPORT =====

/**
 * Load a plan from a directory
 *
 * @param path - Path to the plan directory
 * @param options - Loading options
 * @returns The loaded plan
 *
 * @example
 * ```typescript
 * const plan = await loadPlan('./prompts/big-splitup');
 * console.log(plan.metadata.code); // 'big-splitup'
 * console.log(plan.steps.length);  // 11
 * ```
 */
export async function loadPlan(
    path: string,
    options: LoadPlanOptions = {}
): Promise<Plan> {
    const {
        includeFeedback = true,
        includeEvidence = true,
        parseStatus = true,
    } = options;

    // Resolve to absolute path
    const planPath = resolve(path);

    // Verify path exists and is directory
    let pathStat;
    try {
        pathStat = await stat(planPath);
    } catch {
        throw new Error(`Plan path does not exist: ${planPath}`);
    }

    if (!pathStat.isDirectory()) {
        throw new Error(`Plan path is not a directory: ${planPath}`);
    }

    // Discover files
    const files = await discoverPlanFiles(planPath);

    // Extract metadata
    const metadata = await extractMetadata(planPath, files);

    // Load steps
    const steps =
        files.steps.length > 0 ? await loadSteps(planPath, files) : [];

    // Initialize state
    let state: PlanState = {
        status: "pending",
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 0,
    };

    // Parse STATUS.md if present and requested
    if (parseStatus && files.status) {
        const statusContent = await readFile(
            join(planPath, files.status),
            "utf-8"
        );
        state = parseStatusDocument(statusContent, steps);
    }

    // Load feedback if requested
    const feedback =
        includeFeedback && files.feedbackDir
            ? await loadFeedbackRecords(join(planPath, files.feedbackDir))
            : undefined;

    // Load evidence if requested
    const evidence =
        includeEvidence && files.evidenceDir
            ? await loadEvidenceRecords(join(planPath, files.evidenceDir))
            : undefined;

    return {
        metadata,
        files,
        steps,
        state,
        feedback,
        evidence,
    };
}

// ===== FILE DISCOVERY =====

/**
 * Discover all files and directories in a plan
 */
async function discoverPlanFiles(planPath: string): Promise<PlanFiles> {
    const files: PlanFiles = {
        steps: [],
        subdirectories: [],
    };

    const entries = await readdir(planPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            // Track subdirectories
            files.subdirectories.push(entry.name);

            // Check standard directories
            if (entry.name === PLAN_CONVENTIONS.standardDirs.plan) {
                files.steps = await discoverStepFiles(
                    join(planPath, entry.name)
                );
            } else if (entry.name === PLAN_CONVENTIONS.standardDirs.feedback) {
                files.feedbackDir = entry.name;
                files.feedbackFiles = await discoverFeedbackFiles(
                    join(planPath, entry.name)
                );
            } else if (entry.name === PLAN_CONVENTIONS.standardDirs.evidence) {
                files.evidenceDir = entry.name;
                files.evidenceFiles = await discoverEvidenceFiles(
                    join(planPath, entry.name)
                );
            } else if (entry.name === PLAN_CONVENTIONS.standardDirs.analysis) {
                files.analysisDir = entry.name;
            } else if (entry.name === PLAN_CONVENTIONS.standardDirs.history) {
                files.historyDir = entry.name;
            }
        } else if (entry.isFile()) {
            const name = entry.name;

            // Check standard files
            if (name === PLAN_CONVENTIONS.standardFiles.summary) {
                files.summary = name;
            } else if (name === PLAN_CONVENTIONS.standardFiles.status) {
                files.status = name;
            } else if (name === PLAN_CONVENTIONS.standardFiles.executionPlan) {
                files.executionPlan = name;
            } else if (name === PLAN_CONVENTIONS.standardFiles.readme) {
                files.readme = name;
            } else if (name === PLAN_CONVENTIONS.standardFiles.changelog) {
                files.changelog = name;
            } else if (isMetaPromptFile(name, basename(planPath))) {
                files.metaPrompt = name;
            }
        }
    }

    // If no plan/ subdirectory, check for step files in root
    if (files.steps.length === 0) {
        const rootSteps = await discoverStepFiles(planPath);
        if (rootSteps.length > 0) {
            files.steps = rootSteps;
        }
    }

    return files;
}

/**
 * Check if a file is a meta-prompt file
 */
function isMetaPromptFile(filename: string, planCode: string): boolean {
    for (const pattern of PLAN_CONVENTIONS.metaPromptPatterns) {
        const expected = pattern.replace("{code}", planCode);
        if (filename === expected) {
            return true;
        }
    }
    return false;
}

/**
 * Discover step files in a directory
 */
async function discoverStepFiles(dir: string): Promise<string[]> {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return [];
    }

    const stepFiles: string[] = [];

    for (const entry of entries) {
        if (PLAN_CONVENTIONS.stepPattern.test(entry)) {
            stepFiles.push(entry);
        }
    }

    // Sort by step number
    return stepFiles.sort((a, b) => {
        const matchA = a.match(PLAN_CONVENTIONS.stepPattern);
        const matchB = b.match(PLAN_CONVENTIONS.stepPattern);
        if (!matchA || !matchB) return 0;
        const numA = parseInt(matchA[1]);
        const numB = parseInt(matchB[1]);
        return numA - numB;
    });
}

/**
 * Discover feedback files in a directory
 */
async function discoverFeedbackFiles(dir: string): Promise<string[]> {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return [];
    }

    const feedbackFiles: string[] = [];

    for (const entry of entries) {
        if (PLAN_CONVENTIONS.feedbackPattern.test(entry)) {
            feedbackFiles.push(entry);
        }
    }

    // Sort by ID
    return feedbackFiles.sort((a, b) => {
        const matchA = a.match(PLAN_CONVENTIONS.feedbackPattern);
        const matchB = b.match(PLAN_CONVENTIONS.feedbackPattern);
        if (!matchA || !matchB) return 0;
        return matchA[1].localeCompare(matchB[1]);
    });
}

/**
 * Discover evidence files in a directory
 */
async function discoverEvidenceFiles(dir: string): Promise<string[]> {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return [];
    }

    const evidenceFiles: string[] = [];

    for (const entry of entries) {
        for (const pattern of PLAN_CONVENTIONS.evidencePatterns) {
            if (pattern.test(entry)) {
                evidenceFiles.push(entry);
                break;
            }
        }
    }

    return evidenceFiles.sort();
}

// ===== STEP LOADING =====

/**
 * Load step data from files
 */
async function loadSteps(
    planPath: string,
    files: PlanFiles
): Promise<PlanStep[]> {
    const steps: PlanStep[] = [];

    // Determine step directory (plan/ or root)
    const stepDir = files.subdirectories.includes(
        PLAN_CONVENTIONS.standardDirs.plan
    )
        ? join(planPath, PLAN_CONVENTIONS.standardDirs.plan)
        : planPath;

    for (const filename of files.steps) {
        const match = filename.match(PLAN_CONVENTIONS.stepPattern);
        if (!match) continue;

        const [, numberStr, code] = match;
        const number = parseInt(numberStr);
        const filePath = join(stepDir, filename);

        let content: string;
        try {
            content = await readFile(filePath, "utf-8");
        } catch {
            // File doesn't exist, skip
            continue;
        }

        // Parse dependencies from step content
        const dependencies = parseDependenciesFromContent(content);

        steps.push({
            number,
            code,
            filename,
            title: extractTitle(content) || formatCode(code),
            description: extractDescription(content),
            status: "pending", // Default, may be overridden by STATUS.md
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            filePath,
        });
    }

    return steps;
}

// ===== METADATA EXTRACTION =====

/**
 * Extract plan metadata from files
 */
async function extractMetadata(
    planPath: string,
    files: PlanFiles
): Promise<PlanMetadata> {
    const manifestMetadata = await readPlanManifestMetadata(planPath);
    const code = basename(planPath);
    let name = formatCode(code);
    let description: string | undefined;

    // Try to extract from SUMMARY.md
    if (files.summary) {
        try {
            const content = await readFile(
                join(planPath, files.summary),
                "utf-8"
            );
            const extractedName = extractTitle(content);
            if (extractedName) {
                name = extractedName;
            }
            description = extractFirstParagraph(content);
        } catch {
            // File read failed, use defaults
        }
    }

    return {
        code,
        name,
        description,
        projectPath: manifestMetadata.projectPath,
        path: planPath,
    };
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(markdown: string): string | null {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

/**
 * Extract description from markdown (first paragraph after title)
 */
function extractDescription(markdown: string): string | undefined {
    return extractFirstParagraph(markdown);
}

/**
 * Extract first paragraph from markdown
 */
function extractFirstParagraph(markdown: string): string | undefined {
    const lines = markdown.split("\n");
    let foundTitle = false;
    let paragraph = "";

    for (const line of lines) {
        if (line.startsWith("#")) {
            if (foundTitle && paragraph) {
                break; // Hit another heading
            }
            foundTitle = true;
            continue;
        }

        if (foundTitle && line.trim()) {
            // Skip special lines
            if (
                line.startsWith("-") ||
                line.startsWith("|") ||
                line.startsWith(">") ||
                line.startsWith("```")
            ) {
                if (paragraph) break;
                continue;
            }
            paragraph += line.trim() + " ";
        } else if (foundTitle && paragraph && !line.trim()) {
            break; // End of paragraph
        }
    }

    const result = paragraph.trim();
    return result || undefined;
}

/**
 * Format a code slug into a readable name
 */
function formatCode(code: string): string {
    return code
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ===== STATUS PARSING (Basic) =====

// Status emoji strings for matching
const STATUS_EMOJIS = ["⬜", "🔄", "✅", "❌", "⏸️", "⏭️"];

/**
 * Extract status emoji from a string
 */
function findStatusEmoji(text: string): string | null {
    for (const emoji of STATUS_EMOJIS) {
        if (text.includes(emoji)) {
            return emoji;
        }
    }
    return null;
}

/**
 * Parse STATUS.md content into PlanState
 * Note: This is a basic implementation. Full parsing is in Step 05.
 */
function parseStatusDocument(content: string, steps: PlanStep[]): PlanState {
    const state: PlanState = {
        status: "pending",
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 0,
    };

    // Parse status from content - look for Status row in table
    const statusRowMatch = content.match(/\*\*Status\*\*\s*\|\s*([^|]+)/i);
    if (statusRowMatch) {
        const emoji = findStatusEmoji(statusRowMatch[1]);
        if (emoji) {
            const statusFromEmoji =
                PLAN_CONVENTIONS.emojiToStatus[
                    emoji as keyof typeof PLAN_CONVENTIONS.emojiToStatus
                ];
            if (statusFromEmoji) {
                state.status = statusFromEmoji;
            }
        }
    }

    // Parse step statuses from table - look for rows with step numbers
    const lines = content.split("\n");
    for (const line of lines) {
        // Match lines that look like step status rows: | 01 | Name | ✅ |
        const stepMatch = line.match(/^\|\s*(\d{2})\s*\|[^|]+\|([^|]+)\|/);
        if (stepMatch) {
            const stepNum = parseInt(stepMatch[1]);
            const statusCell = stepMatch[2];
            const emoji = findStatusEmoji(statusCell);

            if (emoji) {
                const status =
                    PLAN_CONVENTIONS.emojiToStatus[
                        emoji as keyof typeof PLAN_CONVENTIONS.emojiToStatus
                    ];
                if (status) {
                    const step = steps.find((s) => s.number === stepNum);
                    if (step) {
                        step.status = status;
                    }
                }
            }
        }
    }

    // Calculate progress
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    state.progress =
        steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

    // Find current step (first in_progress)
    const currentStep = steps.find((s) => s.status === "in_progress");
    if (currentStep) {
        state.currentStep = currentStep.number;
    }

    // Find last completed step
    const completedStepNumbers = steps
        .filter((s) => s.status === "completed")
        .map((s) => s.number);
    if (completedStepNumbers.length > 0) {
        state.lastCompletedStep = Math.max(...completedStepNumbers);
    }

    return state;
}

// ===== FEEDBACK LOADING =====

/**
 * Load feedback records from directory
 */
async function loadFeedbackRecords(
    feedbackPath: string
): Promise<FeedbackRecord[]> {
    let files: string[];
    try {
        files = await readdir(feedbackPath);
    } catch {
        return [];
    }

    const records: FeedbackRecord[] = [];

    for (const file of files) {
        if (!PLAN_CONVENTIONS.feedbackPattern.test(file)) continue;

        try {
            const content = await readFile(join(feedbackPath, file), "utf-8");
            const record = parseFeedbackFile(file, content);
            if (record) records.push(record);
        } catch {
            // Skip files that can't be read
        }
    }

    return records.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Parse a feedback file into a FeedbackRecord
 */
function parseFeedbackFile(
    filename: string,
    content: string
): FeedbackRecord | null {
    const match = filename.match(PLAN_CONVENTIONS.feedbackPattern);
    if (!match) return null;

    const [, id, titleSlug] = match;

    // Parse frontmatter and content
    const { frontmatter, body } = parseFrontmatter(content);

    // Parse participants
    const participants: FeedbackParticipant[] = [];
    if (Array.isArray(frontmatter.participants)) {
        for (const p of frontmatter.participants) {
            if (typeof p === "string") {
                participants.push({ name: p, type: "human" });
            } else if (p && typeof p === "object") {
                const obj = p as Record<string, unknown>;
                participants.push({
                    name: (typeof obj.name === "string" ? obj.name : undefined) || "Unknown",
                    type: (obj.type === "human" || obj.type === "ai" ? obj.type : "human"),
                    model: typeof obj.model === "string" ? obj.model : undefined,
                });
            }
        }
    }

    // Determine platform
    let platform: FeedbackPlatform = "other";
    if (typeof frontmatter.platform === "string") {
        const validPlatforms: FeedbackPlatform[] = [
            "cursor",
            "chatgpt",
            "slack",
            "email",
            "meeting",
            "voice",
            "document",
            "other",
        ];
        if (validPlatforms.includes(frontmatter.platform as FeedbackPlatform)) {
            platform = frontmatter.platform as FeedbackPlatform;
        }
    }

    return {
        id,
        title: (typeof frontmatter.title === "string" ? frontmatter.title : undefined) || formatCode(titleSlug),
        createdAt: (typeof frontmatter.date === "string" || typeof frontmatter.date === "number") ? new Date(frontmatter.date) : new Date(),
        participants:
            participants.length > 0
                ? participants
                : [{ name: "Unknown", type: "human" }],
        platform,
        planVersion: typeof frontmatter.planVersion === "string" ? frontmatter.planVersion : undefined,
        feedback: body.trim(),
        resolution: typeof frontmatter.resolution === "string" ? frontmatter.resolution : undefined,
        changes: Array.isArray(frontmatter.changes) ? frontmatter.changes.filter((c): c is string => typeof c === "string") : undefined,
        openQuestions: Array.isArray(frontmatter.openQuestions) ? frontmatter.openQuestions.filter((q): q is string => typeof q === "string") : undefined,
        filename,
    };
}

// ===== EVIDENCE LOADING =====

/**
 * Load evidence records from directory
 */
async function loadEvidenceRecords(
    evidencePath: string
): Promise<EvidenceRecord[]> {
    let files: string[];
    try {
        files = await readdir(evidencePath);
    } catch {
        return [];
    }

    const records: EvidenceRecord[] = [];

    for (const file of files) {
        // Check against all evidence patterns
        let matched = false;
        for (const pattern of PLAN_CONVENTIONS.evidencePatterns) {
            if (pattern.test(file)) {
                matched = true;
                break;
            }
        }
        if (!matched) continue;

        try {
            const content = await readFile(join(evidencePath, file), "utf-8");
            const record = parseEvidenceFile(file, content);
            if (record) records.push(record);
        } catch {
            // Skip files that can't be read
        }
    }

    return records.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Parse an evidence file into an EvidenceRecord
 */
function parseEvidenceFile(
    filename: string,
    content: string
): EvidenceRecord | null {
    // Determine evidence type from filename pattern
    let type: EvidenceType = "reference";
    let titleMatch: RegExpMatchArray | null = null;

    for (let i = 0; i < PLAN_CONVENTIONS.evidencePatterns.length; i++) {
        const pattern = PLAN_CONVENTIONS.evidencePatterns[i];
        const match = filename.match(pattern);
        if (match) {
            titleMatch = match;
            // Map index to type
            const types: EvidenceType[] = [
                "case-study",
                "research",
                "analysis",
                "example",
            ];
            type = types[i] || "reference";
            break;
        }
    }

    if (!titleMatch) return null;

    // Parse frontmatter
    const { frontmatter, body } = parseFrontmatter(content);

    // Extract title from frontmatter or first heading
    const title =
        frontmatter.title ||
        extractTitle(body) ||
        formatCode(titleMatch[1] || filename);

    // Generate ID from filename
    const id = filename.replace(/\.md$/, "");

    return {
        id,
        type,
        title: typeof title === "string" ? title : "",
        createdAt: (typeof frontmatter.date === "string" || typeof frontmatter.date === "number") ? new Date(frontmatter.date) : new Date(),
        source: typeof frontmatter.source === "string" ? frontmatter.source : undefined,
        filename,
        summary: (typeof frontmatter.summary === "string" ? frontmatter.summary : undefined) || extractFirstParagraph(body),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((t): t is string => typeof t === "string") : undefined,
    };
}

// ===== UTILITIES =====

interface ParsedFrontmatter {
    frontmatter: Record<string, unknown>;
    body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): ParsedFrontmatter {
    // Use indexOf to avoid polynomial regex
    if (!content.startsWith('---\n')) {
        return { frontmatter: {}, body: content };
    }
    
    const endMarker = content.indexOf('\n---\n', 4);
    if (endMarker === -1) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = content.substring(4, endMarker);
    const body = content.substring(endMarker + 5);

    // Simple YAML parsing (key: value, arrays with - prefix)
    const frontmatter: Record<string, unknown> = {};
    const lines = frontmatterStr.split("\n");
    let currentKey: string | null = null;
    let currentArray: unknown[] | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Array item
        if (trimmed.startsWith("- ") && currentKey) {
            if (!currentArray) {
                currentArray = [];
                frontmatter[currentKey] = currentArray;
            }
            const value = trimmed.slice(2).trim();
            // Check if it's an object (has colon)
            if (value.includes(":")) {
                const obj: Record<string, string> = {};
                const parts = value.split(",").map((p) => p.trim());
                for (const part of parts) {
                    const [k, v] = part.split(":").map((s) => s.trim());
                    if (k && v) {
                        obj[k] = v.replace(/^["']|["']$/g, "");
                    }
                }
                currentArray.push(obj);
            } else {
                currentArray.push(value.replace(/^["']|["']$/g, ""));
            }
            continue;
        }

        // Key-value pair
        const kvMatch = line.match(/^(\w+):\s*(.*)$/);
        if (kvMatch) {
            const [, key, value] = kvMatch;
            currentKey = key;
            currentArray = null;

            if (value.trim()) {
                // Inline value
                frontmatter[key] = value.trim().replace(/^["']|["']$/g, "");
            }
            // If no value, might be followed by array items
        }
    }

    return { frontmatter, body };
}

