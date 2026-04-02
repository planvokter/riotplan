import {
    appendIdeaSectionBulletSqlite,
    readSqliteStatusSnapshot,
    resolveProjectRootForBuild,
    type DirectoryStepDeps,
    type CompleteStepInput,
    startDirectoryStep,
    completeDirectoryStep,
    addDirectoryStep,
    removeDirectoryStep,
    moveDirectoryStep,
} from "./services/index.js";

import {
    transitionSqliteLifecycleStage,
} from "./services/lifecycle.js";

export interface CoreComposition {
    lifecycle: {
        transitionSqliteLifecycleStage: typeof transitionSqliteLifecycleStage;
    };
    steps: {
        startDirectoryStep: (deps: DirectoryStepDeps, planPath: string, stepNumber: number) => Promise<{ planId: string; step: number }>;
        completeDirectoryStep: (deps: DirectoryStepDeps, planPath: string, stepNumber: number, input: CompleteStepInput) => Promise<{ planId: string; step: number; planCompleted: boolean }>;
        addDirectoryStep: (deps: DirectoryStepDeps, planPath: string, title: string, number?: number, after?: number) => Promise<{ planId: string; step: number; file: string; renamedFiles: Array<{ from: string; to: string }> }>;
        removeDirectoryStep: (deps: DirectoryStepDeps, planPath: string, stepNumber: number) => Promise<{ planId: string; removedStep: number; removedTitle: string; deletedFile: string; renamedFiles: Array<{ from: string; to: string }> }>;
        moveDirectoryStep: (deps: DirectoryStepDeps, planPath: string, fromStep: number, toStep: number) => Promise<{ planId: string; step: number; from: number; to: number; renamedFiles: Array<{ from: string; to: string }> }>;
    };
    status: {
        readSqliteStatusSnapshot: typeof readSqliteStatusSnapshot;
    };
    idea: {
        appendIdeaSectionBulletSqlite: typeof appendIdeaSectionBulletSqlite;
    };
    build: {
        resolveProjectRootForBuild: typeof resolveProjectRootForBuild;
    };
}

export function resolveCoreServices(): CoreComposition {
    return {
        lifecycle: {
            transitionSqliteLifecycleStage,
        },
        steps: {
            startDirectoryStep,
            completeDirectoryStep,
            addDirectoryStep,
            removeDirectoryStep,
            moveDirectoryStep,
        },
        status: {
            readSqliteStatusSnapshot,
        },
        idea: {
            appendIdeaSectionBulletSqlite,
        },
        build: {
            resolveProjectRootForBuild,
        },
    };
}
