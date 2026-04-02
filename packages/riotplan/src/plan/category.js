function normalizePath(pathValue) {
    return pathValue.replace(/\\/g, '/');
}
export function getPlanCategory(planFilePath) {
    const segments = normalizePath(planFilePath)
        .split('/')
        .map((segment) => segment.toLowerCase());
    if (segments.includes('done'))
        return 'done';
    if (segments.includes('hold'))
        return 'hold';
    return 'active';
}
//# sourceMappingURL=category.js.map