/**
 * MCP Resource Handlers
 *
 * Provides read-only access to plan data via resources
 */

import type { McpResource } from '../types.js';
import { readPlanResource } from './plan.js';
import { readStatusResource } from './status.js';
import { readStepsResource } from './steps.js';
import { readStepResource } from './step.js';
import { readIdeaResource } from './idea.js';
import { readTimelineResource } from './timeline.js';
import { readPromptsListResource, readPromptResource } from './prompts.js';
import { readEvidenceListResource, readEvidenceResource } from './evidence.js';
import { readShapingResource } from './shaping.js';
import { readCheckpointsListResource, readCheckpointResource } from './checkpoints.js';
import { readArtifactResource } from './artifact.js';
import { parseUri } from '../uri.js';
import { resolveDirectory } from '../tools/shared.js';

/**
 * Resolve planId to an internal plan path.
 * In HTTP mode, plansDir is treated as the base directory.
 */
function resolveResourcePath(planId: string | undefined, plansDir?: string): string {
    const baseDir = plansDir || process.cwd();
    return resolveDirectory({ planId }, { workingDirectory: baseDir });
}

/**
 * Get all available resources
 */
export function getResources(): McpResource[] {
    return [
        // Plan execution resources
        {
            uri: 'riotplan://plan/{planId}',
            name: 'Plan',
            description: 'Read plan metadata and structure',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://status/{planId}',
            name: 'Status',
            description: 'Read plan status and progress',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://steps/{planId}',
            name: 'Steps',
            description: 'List all steps in a plan',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://step/{planId}?number={number}',
            name: 'Step',
            description: 'Read a specific step with full content',
            mimeType: 'application/json',
        },
        
        // Ideation context resources
        {
            uri: 'riotplan://idea/{planId}',
            name: 'Idea',
            description: 'Read IDEA.md file with core concept, constraints, questions, and evidence',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://execution-plan/{planId}',
            name: 'Execution Plan',
            description: 'Read EXECUTION_PLAN.md as a first-class artifact resource',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://summary/{planId}',
            name: 'Summary',
            description: 'Read SUMMARY.md as a first-class artifact resource',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://provenance/{planId}',
            name: 'Provenance',
            description: 'Read PROVENANCE.md as a first-class artifact resource',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://artifact/{planId}?type={type}',
            name: 'Artifact',
            description: 'Read an artifact by type (idea, shaping, summary, execution_plan, status, provenance)',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://timeline/{planId}',
            name: 'Timeline',
            description: 'Read .history/timeline.jsonl with full evolution of thinking (notes, narratives, decisions)',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://history/{planId}',
            name: 'History',
            description: 'Alias for timeline events for history-focused UIs',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://prompts/{planId}',
            name: 'Prompts List',
            description: 'List all prompt files in .history/prompts/ directory',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://prompt/{planId}?file={file}',
            name: 'Prompt',
            description: 'Read a specific prompt file with conversational context',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://evidence/{planId}',
            name: 'Evidence List',
            description: 'List all evidence files in evidence/ directory',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://evidence-file/{planId}?file={file}',
            name: 'Evidence File',
            description: 'Read a specific evidence file',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://shaping/{planId}',
            name: 'Shaping',
            description: 'Read SHAPING.md with approaches, tradeoffs, and selected approach',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://checkpoints/{planId}',
            name: 'Checkpoints List',
            description: 'List all checkpoints in .history/checkpoints/ directory',
            mimeType: 'application/json',
        },
        {
            uri: 'riotplan://checkpoint/{planId}?name={name}',
            name: 'Checkpoint',
            description: 'Read a specific checkpoint with snapshot and prompt context',
            mimeType: 'application/json',
        },
    ];
}

/**
 * Read a resource by URI
 * @param uri - The riotplan:// URI to read
 * @param plansDir - Optional base directory for plan paths (used in HTTP/remote mode; when set, all paths are resolved relative to this)
 */
export async function readResource(uri: string, plansDir?: string): Promise<any> {
    const parsed = parseUri(uri);
    const planPath = resolveResourcePath(parsed.path, plansDir);

    switch (parsed.type) {
        // Plan execution resources
        case 'plan':
            return await readPlanResource(planPath);
        case 'status':
            return await readStatusResource(planPath);
        case 'steps':
            return await readStepsResource(planPath);
        case 'step': {
            const stepNumber = parsed.query?.number ? parseInt(parsed.query.number) : undefined;
            if (!stepNumber) {
                throw new Error('Step number is required for step resource');
            }
            return await readStepResource(planPath, stepNumber);
        }
        
        // Ideation context resources
        case 'idea':
            return await readIdeaResource(planPath);
        case 'execution-plan':
            return await readArtifactResource(planPath, 'execution_plan');
        case 'summary':
            return await readArtifactResource(planPath, 'summary');
        case 'provenance':
            return await readArtifactResource(planPath, 'provenance');
        case 'artifact': {
            const type = parsed.query?.type;
            if (!type) {
                throw new Error('Artifact type is required for artifact resource');
            }
            return await readArtifactResource(planPath, type);
        }
        case 'timeline':
            return await readTimelineResource(planPath);
        case 'history':
            return await readTimelineResource(planPath);
        case 'prompts':
            return await readPromptsListResource(planPath);
        case 'prompt': {
            const file = parsed.query?.file;
            if (!file) {
                throw new Error('File name is required for prompt resource');
            }
            return await readPromptResource(planPath, file);
        }
        case 'evidence':
            return await readEvidenceListResource(planPath);
        case 'evidence-file': {
            const file = parsed.query?.file;
            if (!file) {
                throw new Error('File name is required for evidence resource');
            }
            return await readEvidenceResource(planPath, file);
        }
        case 'shaping':
            return await readShapingResource(planPath);
        case 'checkpoints':
            return await readCheckpointsListResource(planPath);
        case 'checkpoint': {
            const name = parsed.query?.name;
            if (!name) {
                throw new Error('Checkpoint name is required for checkpoint resource');
            }
            return await readCheckpointResource(planPath, name);
        }
        
        default:
            throw new Error(`Unknown resource type: ${parsed.type}`);
    }
}
