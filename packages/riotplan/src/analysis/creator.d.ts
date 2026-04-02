export interface CreateAnalysisOptions {
    planPath: string;
    planName: string;
    initialPrompt: string;
}
/**
 * Create analysis entries in a .plan SQLite file
 */
export declare function createAnalysisDirectory(options: CreateAnalysisOptions): Promise<string>;
//# sourceMappingURL=creator.d.ts.map