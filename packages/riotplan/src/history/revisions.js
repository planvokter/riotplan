/**
 * Revision Management
 *
 * Create and manage plan revisions.
 */
/**
 * Create a new revision
 */
export function createRevision(history, message, options) {
    const currentVersion = history.currentVersion;
    const [major, minor] = currentVersion.split(".").map(Number);
    const newVersion = `${major}.${minor + 1}`;
    const revision = {
        version: newVersion,
        createdAt: new Date(),
        message,
        author: options?.author,
        feedbackId: options?.feedbackId,
    };
    history.revisions.push(revision);
    history.currentVersion = newVersion;
    return revision;
}
/**
 * Get a specific revision by version
 */
export function getRevision(history, version) {
    const index = history.revisions.findIndex((r) => r.version === version);
    if (index === -1)
        return undefined;
    const revision = history.revisions[index];
    return {
        ...revision,
        index,
        isCurrent: revision.version === history.currentVersion,
    };
}
/**
 * List all revisions
 */
export function listRevisions(history) {
    return history.revisions.map((r, index) => ({
        ...r,
        index,
        isCurrent: r.version === history.currentVersion,
    }));
}
/**
 * Compare two revisions
 */
export function compareRevisions(history, fromVersion, toVersion) {
    const from = getRevision(history, fromVersion);
    const to = getRevision(history, toVersion);
    if (!from || !to)
        return undefined;
    const fromTime = from.createdAt instanceof Date
        ? from.createdAt.getTime()
        : new Date(from.createdAt).getTime();
    const toTime = to.createdAt instanceof Date
        ? to.createdAt.getTime()
        : new Date(to.createdAt).getTime();
    return {
        from,
        to,
        timeDiff: toTime - fromTime,
        revisionCount: Math.abs(to.index - from.index),
    };
}
/**
 * Get the latest revision
 */
export function getLatestRevision(history) {
    if (history.revisions.length === 0)
        return undefined;
    const index = history.revisions.length - 1;
    const revision = history.revisions[index];
    return {
        ...revision,
        index,
        isCurrent: true,
    };
}
/**
 * Generate a new version number
 */
export function nextVersion(currentVersion) {
    const [major, minor] = currentVersion.split(".").map(Number);
    return `${major}.${minor + 1}`;
}
//# sourceMappingURL=revisions.js.map