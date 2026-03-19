import {
    appendIdeaSectionBulletSqlite,
    readSqliteStatusSnapshot,
    resolveProjectRootForBuild,
    transitionSqliteLifecycleStage,
    startDirectoryStep,
    completeDirectoryStep,
    addDirectoryStep,
    removeDirectoryStep,
    moveDirectoryStep,
} from "./services/index.js";

export interface CoreComposition {
    lifecycle: {
        transitionSqliteLifecycleStage: typeof transitionSqliteLifecycleStage;
    };
    steps: {
        startDirectoryStep: typeof startDirectoryStep;
        completeDirectoryStep: typeof completeDirectoryStep;
        addDirectoryStep: typeof addDirectoryStep;
        removeDirectoryStep: typeof removeDirectoryStep;
        moveDirectoryStep: typeof moveDirectoryStep;
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
