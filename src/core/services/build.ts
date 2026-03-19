import { dirname, resolve } from "node:path";
import { readdirSync } from "node:fs";

const PROJECT_ROOT_INDICATORS = [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "setup.py",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "CMakeLists.txt",
    "Gemfile",
    "Package.swift",
    ".git",
];

export function resolveProjectRootForBuild(startPath: string): string {
    let current = resolve(startPath);
    const maxDepth = 10;
    for (let i = 0; i < maxDepth; i++) {
        try {
            const entries = readdirSync(current);
            if (PROJECT_ROOT_INDICATORS.some((ind) => entries.includes(ind))) {
                return current;
            }
        } catch {
            // ignore unreadable directories while walking up
        }
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return resolve(startPath);
}
