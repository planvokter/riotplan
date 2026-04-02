export type PlanCategory = 'active' | 'done' | 'hold';

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/');
}

export function getPlanCategory(planFilePath: string): PlanCategory {
    const segments = normalizePath(planFilePath)
        .split('/')
        .map((segment) => segment.toLowerCase());
    if (segments.includes('done')) return 'done';
    if (segments.includes('hold')) return 'hold';
    return 'active';
}
