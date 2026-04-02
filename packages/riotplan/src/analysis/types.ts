export interface Analysis {
    /** Path to analysis directory */
    path: string;
    
    /** Requirements document content */
    requirements: string;
    
    /** Philosophy/approach document (optional) */
    philosophy?: string;
    
    /** All elaboration prompts */
    elaborations: ElaborationRecord[];
    
    /** Analysis metadata */
    metadata: AnalysisMetadata;
}

export interface ElaborationRecord {
    id: string;
    timestamp: Date;
    content: string;
}

export interface AnalysisMetadata {
    createdAt: Date;
    updatedAt: Date;
    elaborationCount: number;
    status: "draft" | "ready" | "converted";
}
