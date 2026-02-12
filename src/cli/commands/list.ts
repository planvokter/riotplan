/**
 * List Command
 * 
 * Lists all plans in the plans directory with their status.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { loadConfig } from '../../config/index.js';

/**
 * Plan category based on directory location
 */
type PlanCategory = 'active' | 'hold' | 'done';

/**
 * Plan info for display
 */
interface PlanInfo {
    name: string;
    path: string;
    stage?: string;
    status?: string;
    progress?: number;
    currentStep?: string;
    // From plan.yaml manifest
    id?: string;
    title?: string;
    catalysts?: string[];
    created?: string;
    // Category based on directory
    category: PlanCategory;
}

/**
 * Check if a directory contains plan subdirectories
 */
function hasPlansInDirectory(dir: string): boolean {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            if (entry.name === 'node_modules') continue;
            
            const fullPath = path.join(dir, entry.name);
            if (getPlanInfo(fullPath) !== null) {
                return true;
            }
        }
    } catch {
        // Ignore errors
    }
    return false;
}

/**
 * Get status icon for a given status/stage
 */
function getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
        // Lifecycle stages
        idea: '💡',
        shaping: '🔨',
        built: '📋',
        executing: '🔄',
        completed: '✅',
        cancelled: '❌',
        // Legacy status values
        pending: '⬜',
        in_progress: '🔄',
        done: '✅',
        failed: '❌',
        blocked: '⏸️',
    };
    return icons[status] || '⬜';
}

/**
 * Check if a directory is a plan directory and get its info
 */
function getPlanInfo(planPath: string): PlanInfo | null {
    const name = path.basename(planPath);
    
    try {
        const files = fs.readdirSync(planPath);
        
        // Must have at least one plan indicator
        const hasPlanIndicator = files.includes('LIFECYCLE.md') || 
                                  files.includes('STATUS.md') || 
                                  files.includes('plan') ||
                                  files.includes('IDEA.md') ||
                                  files.includes('plan.yaml');
        
        if (!hasPlanIndicator) {
            return null;
        }
        
        const info: PlanInfo = { name, path: planPath, category: 'active' };
        
        // Try to read plan.yaml manifest for metadata
        const manifestPath = path.join(planPath, 'plan.yaml');
        if (fs.existsSync(manifestPath)) {
            try {
                const content = fs.readFileSync(manifestPath, 'utf-8');
                const manifest = yaml.parse(content);
                if (manifest) {
                    info.id = manifest.id;
                    info.title = manifest.title;
                    info.catalysts = manifest.catalysts;
                    info.created = manifest.created;
                }
            } catch {
                // Ignore parse errors
            }
        }
        
        // Try to read LIFECYCLE.md for stage
        const lifecyclePath = path.join(planPath, 'LIFECYCLE.md');
        if (fs.existsSync(lifecyclePath)) {
            try {
                const content = fs.readFileSync(lifecyclePath, 'utf-8');
                const stageMatch = content.match(/\*\*Stage\*\*:\s*`(\w+)`/);
                if (stageMatch) {
                    info.stage = stageMatch[1];
                }
            } catch {
                // Ignore read errors
            }
        }
        
        // Try to read STATUS.md for status and progress
        const statusPath = path.join(planPath, 'STATUS.md');
        if (fs.existsSync(statusPath)) {
            try {
                const content = fs.readFileSync(statusPath, 'utf-8');
                
                // Extract status
                const statusMatch = content.match(/\*\*Status\*\*\s*\|\s*`(\w+)`/);
                if (statusMatch) {
                    info.status = statusMatch[1];
                }
                
                // Extract current step
                const stepMatch = content.match(/\*\*Current Step\*\*\s*\|\s*([^\n|]+)/);
                if (stepMatch && stepMatch[1].trim() !== '-') {
                    info.currentStep = stepMatch[1].trim();
                }
                
                // Calculate progress from step table
                const completedSteps = (content.match(/✅/g) || []).length;
                const totalSteps = (content.match(/^\|\s*\d+\s*\|/gm) || []).length;
                if (totalSteps > 0) {
                    info.progress = Math.round((completedSteps / totalSteps) * 100);
                }
            } catch {
                // Ignore read errors
            }
        }
        
        return info;
    } catch {
        return null;
    }
}

/**
 * Determine plan category based on its path relative to the plans directory
 */
function getPlanCategory(planPath: string, plansDir: string): PlanCategory {
    const relativePath = path.relative(plansDir, planPath);
    const parts = relativePath.split(path.sep);
    
    // If the plan is in done/ subdirectory
    if (parts[0] === 'done') {
        return 'done';
    }
    // If the plan is in hold/ subdirectory
    if (parts[0] === 'hold') {
        return 'hold';
    }
    // Otherwise it's an active plan
    return 'active';
}

/**
 * Recursively find all plans in a directory
 */
function findPlans(dir: string, plansDir: string, maxDepth: number = 2, currentDepth: number = 0): PlanInfo[] {
    const plans: PlanInfo[] = [];
    
    if (currentDepth > maxDepth) {
        return plans;
    }
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            if (entry.name === 'node_modules') continue;
            
            const fullPath = path.join(dir, entry.name);
            const planInfo = getPlanInfo(fullPath);
            
            if (planInfo) {
                // Add category based on directory location
                planInfo.category = getPlanCategory(fullPath, plansDir);
                plans.push(planInfo);
            } else {
                // Recurse into subdirectories (e.g., plans/done/)
                const subPlans = findPlans(fullPath, plansDir, maxDepth, currentDepth + 1);
                plans.push(...subPlans);
            }
        }
    } catch {
        // Ignore errors reading directory
    }
    
    return plans;
}

/**
 * Format plan info for display
 */
function formatPlanLine(plan: PlanInfo, showPath: boolean = false): string {
    const stage = plan.stage || plan.status || 'unknown';
    const icon = getStatusIcon(stage);
    
    // Use title if available, otherwise use name
    const displayName = plan.title || plan.name;
    let line = `${icon} ${chalk.bold(displayName)}`;
    
    // Show id if different from display name
    if (plan.id && plan.id !== displayName && plan.id !== plan.name) {
        line += chalk.dim(` [${plan.id}]`);
    } else if (plan.title && plan.name !== plan.title) {
        line += chalk.dim(` [${plan.name}]`);
    }
    
    line += chalk.dim(` (${stage})`);
    
    if (plan.progress !== undefined && plan.progress > 0 && plan.progress < 100) {
        line += chalk.cyan(` ${plan.progress}%`);
    }
    
    if (plan.currentStep) {
        line += chalk.dim(` - ${plan.currentStep}`);
    }
    
    if (showPath) {
        line += chalk.dim(`\n   ${plan.path}`);
    }
    
    return line;
}

/**
 * Register the list command
 */
export function registerListCommand(program: Command): void {
    program
        .command('list')
        .alias('ls')
        .description('List all plans with their status')
        .option('-a, --all', 'Include completed and cancelled plans')
        .option('-p, --path', 'Show full paths')
        .option('--json', 'Output as JSON')
        .action(async (options: {
            all?: boolean;
            path?: boolean;
            json?: boolean;
        }) => {
            try {
                // Try to find plans directory:
                // 1. Check if current directory has plans/ subdirectory
                // 2. Check if current directory IS a plans directory (has plan subdirs)
                // 3. Fall back to config file
                let resolvedPlansDir: string;
                
                const cwd = process.cwd();
                const cwdPlans = path.join(cwd, 'plans');
                
                if (fs.existsSync(cwdPlans) && fs.statSync(cwdPlans).isDirectory()) {
                    // Current directory has a plans/ subdirectory
                    resolvedPlansDir = cwdPlans;
                } else if (hasPlansInDirectory(cwd)) {
                    // Current directory contains plan directories
                    resolvedPlansDir = cwd;
                } else {
                    // Fall back to config
                    const config = await loadConfig();
                    const plansDir = config?.planDirectory || './plans';
                    resolvedPlansDir = path.resolve(plansDir);
                }
                
                if (!fs.existsSync(resolvedPlansDir)) {
                    console.error(chalk.red(`Plans directory not found: ${resolvedPlansDir}`));
                    process.exit(1);
                }
                
                const allPlans = findPlans(resolvedPlansDir, resolvedPlansDir);
                
                // Categorize plans by directory location
                const activePlans = allPlans.filter(p => p.category === 'active');
                const holdPlans = allPlans.filter(p => p.category === 'hold');
                const donePlans = allPlans.filter(p => p.category === 'done');
                
                // Sort function: in_progress/executing first, then by name
                const sortPlans = (plans: PlanInfo[]) => {
                    return plans.sort((a, b) => {
                        const aActive = a.stage === 'executing' || a.status === 'in_progress';
                        const bActive = b.stage === 'executing' || b.status === 'in_progress';
                        if (aActive && !bActive) return -1;
                        if (!aActive && bActive) return 1;
                        return a.name.localeCompare(b.name);
                    });
                };
                
                sortPlans(activePlans);
                sortPlans(holdPlans);
                sortPlans(donePlans);
                
                // For JSON output, include category info
                if (options.json) {
                    const output = options.all 
                        ? { active: activePlans, hold: holdPlans, done: donePlans }
                        : { active: activePlans };
                    console.log(JSON.stringify(output, null, 2));
                    return;
                }
                
                // Check if there's anything to show
                if (activePlans.length === 0 && (!options.all || (holdPlans.length === 0 && donePlans.length === 0))) {
                    if (options.all) {
                        console.log(chalk.dim('No plans found.'));
                    } else {
                        const hiddenCount = holdPlans.length + donePlans.length;
                        if (hiddenCount > 0) {
                            console.log(chalk.dim(`No active plans. Use -a to show ${hiddenCount} plans on hold or done.`));
                        } else {
                            console.log(chalk.dim('No plans found.'));
                        }
                    }
                    return;
                }
                
                // Display active plans
                if (activePlans.length > 0) {
                    console.log(chalk.bold('Active Plans:'));
                    console.log();
                    for (const plan of activePlans) {
                        console.log(formatPlanLine(plan, options.path));
                    }
                } else {
                    console.log(chalk.dim('No active plans.'));
                }
                
                // Display hold and done plans only with -a flag
                if (options.all) {
                    if (holdPlans.length > 0) {
                        console.log();
                        console.log(chalk.bold.yellow('Plans On Hold:'));
                        console.log();
                        for (const plan of holdPlans) {
                            console.log(formatPlanLine(plan, options.path));
                        }
                    }
                    
                    if (donePlans.length > 0) {
                        console.log();
                        console.log(chalk.bold.green('Completed Plans:'));
                        console.log();
                        for (const plan of donePlans) {
                            console.log(formatPlanLine(plan, options.path));
                        }
                    }
                }
                
                // Show count summary
                console.log();
                if (options.all) {
                    const parts = [];
                    if (activePlans.length > 0) parts.push(`${activePlans.length} active`);
                    if (holdPlans.length > 0) parts.push(`${holdPlans.length} on hold`);
                    if (donePlans.length > 0) parts.push(`${donePlans.length} done`);
                    console.log(chalk.dim(parts.join(', ')));
                } else {
                    const hiddenCount = holdPlans.length + donePlans.length;
                    if (hiddenCount > 0) {
                        console.log(chalk.dim(`${activePlans.length} active plans (${hiddenCount} on hold/done hidden, use -a to show)`));
                    } else {
                        console.log(chalk.dim(`${activePlans.length} plans`));
                    }
                }
                
            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
