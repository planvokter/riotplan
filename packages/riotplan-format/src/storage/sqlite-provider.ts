/**
 * SQLite Storage Provider
 * 
 * Implements the StorageProvider interface using SQLite (better-sqlite3)
 * for storing plans in a single .plan file.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
    PlanMetadata,
    PlanStep,
    PlanFile,
    TimelineEvent,
    EvidenceRecord,
    FeedbackRecord,
    Checkpoint,
    CheckpointSnapshot,
    StorageResult,
} from '../types.js';
import type { StorageProvider, SearchResult } from './provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * SQLite-based storage provider for .plan files
 */
export class SqliteStorageProvider implements StorageProvider {
    readonly format = 'sqlite' as const;
    readonly path: string;
    private db: Database.Database;
    private planId: number | null = null;

    constructor(planPath: string) {
        this.path = planPath;
        this.db = new Database(planPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }

    /**
     * Initialize the database with schema
     */
    private initializeSchema(): void {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
    }

    /**
     * Get the plan ID, loading it if necessary
     */
    private getPlanId(): number {
        if (this.planId !== null) {
            return this.planId;
        }
        
        const row = this.db.prepare('SELECT id FROM plans LIMIT 1').get() as { id: number } | undefined;
        if (!row) {
            throw new Error('No plan found in database');
        }
        this.planId = row.id;
        return this.planId;
    }

    // ==================== Core Operations ====================

    async exists(): Promise<boolean> {
        try {
            const row = this.db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
            return row.count > 0;
        } catch {
            return false;
        }
    }

    async initialize(metadata: PlanMetadata): Promise<StorageResult<void>> {
        try {
            this.initializeSchema();
            
            // Generate UUID if not provided
            const uuid = metadata.uuid || randomUUID();
            
            const stmt = this.db.prepare(`
                INSERT INTO plans (code, uuid, name, description, stage, created_at, updated_at, schema_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                metadata.id,
                uuid,
                metadata.name,
                metadata.description || null,
                metadata.stage,
                metadata.createdAt,
                metadata.updatedAt,
                metadata.schemaVersion
            );
            
            this.planId = result.lastInsertRowid as number;
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to initialize plan' 
            };
        }
    }

    async close(): Promise<void> {
        this.db.close();
    }

    // ==================== Metadata Operations ====================

    async getMetadata(): Promise<StorageResult<PlanMetadata>> {
        try {
            const row = this.db.prepare(`
                SELECT code, uuid, name, description, stage, created_at, updated_at, schema_version
                FROM plans WHERE id = ?
            `).get(this.getPlanId()) as {
                code: string;
                uuid: string;
                name: string;
                description: string | null;
                stage: string;
                created_at: string;
                updated_at: string;
                schema_version: number;
            } | undefined;

            if (!row) {
                return { success: false, error: 'Plan not found' };
            }

            return {
                success: true,
                data: {
                    id: row.code,
                    uuid: row.uuid,
                    name: row.name,
                    description: row.description || undefined,
                    stage: row.stage as PlanMetadata['stage'],
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    schemaVersion: row.schema_version,
                }
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get metadata' 
            };
        }
    }

    async updateMetadata(metadata: Partial<PlanMetadata>): Promise<StorageResult<void>> {
        try {
            const updates: string[] = [];
            const values: unknown[] = [];

            if (metadata.name !== undefined) {
                updates.push('name = ?');
                values.push(metadata.name);
            }
            if (metadata.description !== undefined) {
                updates.push('description = ?');
                values.push(metadata.description);
            }
            if (metadata.stage !== undefined) {
                updates.push('stage = ?');
                values.push(metadata.stage);
            }

            updates.push('updated_at = ?');
            values.push(new Date().toISOString());
            values.push(this.getPlanId());

            this.db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to update metadata' 
            };
        }
    }

    // ==================== Step Operations ====================

    async getSteps(): Promise<StorageResult<PlanStep[]>> {
        try {
            const rows = this.db.prepare(`
                SELECT number, code, title, description, status, started_at, completed_at, content
                FROM plan_steps WHERE plan_id = ? ORDER BY number
            `).all(this.getPlanId()) as Array<{
                number: number;
                code: string;
                title: string;
                description: string | null;
                status: string;
                started_at: string | null;
                completed_at: string | null;
                content: string;
            }>;

            const steps: PlanStep[] = rows.map(row => ({
                number: row.number,
                code: row.code,
                title: row.title,
                description: row.description || undefined,
                status: row.status as PlanStep['status'],
                startedAt: row.started_at || undefined,
                completedAt: row.completed_at || undefined,
                content: row.content,
            }));

            return { success: true, data: steps };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get steps' 
            };
        }
    }

    async getStep(number: number): Promise<StorageResult<PlanStep | null>> {
        try {
            const row = this.db.prepare(`
                SELECT number, code, title, description, status, started_at, completed_at, content
                FROM plan_steps WHERE plan_id = ? AND number = ?
            `).get(this.getPlanId(), number) as {
                number: number;
                code: string;
                title: string;
                description: string | null;
                status: string;
                started_at: string | null;
                completed_at: string | null;
                content: string;
            } | undefined;

            if (!row) {
                return { success: true, data: null };
            }

            return {
                success: true,
                data: {
                    number: row.number,
                    code: row.code,
                    title: row.title,
                    description: row.description || undefined,
                    status: row.status as PlanStep['status'],
                    startedAt: row.started_at || undefined,
                    completedAt: row.completed_at || undefined,
                    content: row.content,
                }
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get step' 
            };
        }
    }

    async addStep(step: PlanStep): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO plan_steps (plan_id, number, code, title, description, status, started_at, completed_at, content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.getPlanId(),
                step.number,
                step.code,
                step.title,
                step.description || null,
                step.status,
                step.startedAt || null,
                step.completedAt || null,
                step.content
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to add step' 
            };
        }
    }

    async updateStep(number: number, updates: Partial<PlanStep>): Promise<StorageResult<void>> {
        try {
            const fields: string[] = [];
            const values: unknown[] = [];

            if (updates.code !== undefined) {
                fields.push('code = ?');
                values.push(updates.code);
            }
            if (updates.title !== undefined) {
                fields.push('title = ?');
                values.push(updates.title);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.status !== undefined) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.startedAt !== undefined) {
                fields.push('started_at = ?');
                values.push(updates.startedAt);
            }
            if (updates.completedAt !== undefined) {
                fields.push('completed_at = ?');
                values.push(updates.completedAt);
            }
            if (updates.content !== undefined) {
                fields.push('content = ?');
                values.push(updates.content);
            }

            if (fields.length === 0) {
                return { success: true };
            }

            values.push(this.getPlanId(), number);
            this.db.prepare(`UPDATE plan_steps SET ${fields.join(', ')} WHERE plan_id = ? AND number = ?`).run(...values);

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to update step' 
            };
        }
    }

    async deleteStep(number: number): Promise<StorageResult<void>> {
        try {
            this.db.prepare('DELETE FROM plan_steps WHERE plan_id = ? AND number = ?').run(this.getPlanId(), number);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to delete step' 
            };
        }
    }

    // ==================== File Operations ====================

    async getFiles(): Promise<StorageResult<PlanFile[]>> {
        try {
            const rows = this.db.prepare(`
                SELECT file_type, filename, content, created_at, updated_at
                FROM plan_files WHERE plan_id = ?
            `).all(this.getPlanId()) as Array<{
                file_type: string;
                filename: string;
                content: string;
                created_at: string;
                updated_at: string;
            }>;

            const files: PlanFile[] = rows.map(row => ({
                type: row.file_type as PlanFile['type'],
                filename: row.filename,
                content: row.content,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));

            return { success: true, data: files };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get files' 
            };
        }
    }

    async getFile(type: string, filename: string): Promise<StorageResult<PlanFile | null>> {
        try {
            const row = this.db.prepare(`
                SELECT file_type, filename, content, created_at, updated_at
                FROM plan_files WHERE plan_id = ? AND file_type = ? AND filename = ?
            `).get(this.getPlanId(), type, filename) as {
                file_type: string;
                filename: string;
                content: string;
                created_at: string;
                updated_at: string;
            } | undefined;

            if (!row) {
                return { success: true, data: null };
            }

            return {
                success: true,
                data: {
                    type: row.file_type as PlanFile['type'],
                    filename: row.filename,
                    content: row.content,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                }
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get file' 
            };
        }
    }

    async saveFile(file: PlanFile): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO plan_files (plan_id, file_type, filename, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(plan_id, file_type, filename) DO UPDATE SET
                    content = excluded.content,
                    updated_at = excluded.updated_at
            `).run(
                this.getPlanId(),
                file.type,
                file.filename,
                file.content,
                file.createdAt,
                file.updatedAt
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to save file' 
            };
        }
    }

    async deleteFile(type: string, filename: string): Promise<StorageResult<void>> {
        try {
            this.db.prepare('DELETE FROM plan_files WHERE plan_id = ? AND file_type = ? AND filename = ?')
                .run(this.getPlanId(), type, filename);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to delete file' 
            };
        }
    }

    // ==================== Timeline Operations ====================

    async getTimelineEvents(options?: {
        since?: string;
        type?: string;
        limit?: number;
    }): Promise<StorageResult<TimelineEvent[]>> {
        try {
            let sql = 'SELECT id, timestamp, event_type, data FROM timeline_events WHERE plan_id = ?';
            const params: unknown[] = [this.getPlanId()];

            if (options?.since) {
                sql += ' AND timestamp >= ?';
                params.push(options.since);
            }
            if (options?.type) {
                sql += ' AND event_type = ?';
                params.push(options.type);
            }

            sql += ' ORDER BY timestamp DESC';

            if (options?.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            const rows = this.db.prepare(sql).all(...params) as Array<{
                id: string;
                timestamp: string;
                event_type: string;
                data: string;
            }>;

            const events: TimelineEvent[] = rows.map(row => ({
                id: row.id,
                timestamp: row.timestamp,
                type: row.event_type as TimelineEvent['type'],
                data: JSON.parse(row.data),
            }));

            return { success: true, data: events };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get timeline events' 
            };
        }
    }

    async addTimelineEvent(event: TimelineEvent): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO timeline_events (id, plan_id, timestamp, event_type, data)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                event.id || randomUUID(),
                this.getPlanId(),
                event.timestamp,
                event.type,
                JSON.stringify(event.data)
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to add timeline event' 
            };
        }
    }

    // ==================== Evidence Operations ====================

    async getEvidence(): Promise<StorageResult<EvidenceRecord[]>> {
        try {
            const rows = this.db.prepare(`
                SELECT id, description, source, source_url, gathering_method, content, file_path, 
                       relevance_score, original_query, summary, created_at
                FROM evidence_records WHERE plan_id = ?
            `).all(this.getPlanId()) as Array<{
                id: string;
                description: string;
                source: string | null;
                source_url: string | null;
                gathering_method: string | null;
                content: string | null;
                file_path: string | null;
                relevance_score: number | null;
                original_query: string | null;
                summary: string | null;
                created_at: string;
            }>;

            const evidence: EvidenceRecord[] = rows.map(row => ({
                id: row.id,
                description: row.description,
                source: row.source || undefined,
                sourceUrl: row.source_url || undefined,
                gatheringMethod: row.gathering_method as EvidenceRecord['gatheringMethod'],
                content: row.content || undefined,
                filePath: row.file_path || undefined,
                relevanceScore: row.relevance_score ?? undefined,
                originalQuery: row.original_query || undefined,
                summary: row.summary || undefined,
                createdAt: row.created_at,
            }));

            return { success: true, data: evidence };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get evidence' 
            };
        }
    }

    async addEvidence(evidence: EvidenceRecord): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO evidence_records (id, plan_id, description, source, source_url, gathering_method, 
                                              content, file_path, relevance_score, original_query, summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                evidence.id || randomUUID(),
                this.getPlanId(),
                evidence.description,
                evidence.source || null,
                evidence.sourceUrl || null,
                evidence.gatheringMethod || null,
                evidence.content || null,
                evidence.filePath || null,
                evidence.relevanceScore ?? null,
                evidence.originalQuery || null,
                evidence.summary || null,
                evidence.createdAt
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to add evidence' 
            };
        }
    }

    // ==================== Feedback Operations ====================

    async getFeedback(): Promise<StorageResult<FeedbackRecord[]>> {
        try {
            const rows = this.db.prepare(`
                SELECT id, title, platform, content, participants, created_at
                FROM feedback_records WHERE plan_id = ?
            `).all(this.getPlanId()) as Array<{
                id: string;
                title: string | null;
                platform: string | null;
                content: string;
                participants: string | null;
                created_at: string;
            }>;

            const feedback: FeedbackRecord[] = rows.map(row => ({
                id: row.id,
                title: row.title || undefined,
                platform: row.platform || undefined,
                content: row.content,
                participants: row.participants ? JSON.parse(row.participants) : undefined,
                createdAt: row.created_at,
            }));

            return { success: true, data: feedback };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get feedback' 
            };
        }
    }

    async addFeedback(feedback: FeedbackRecord): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO feedback_records (id, plan_id, title, platform, content, participants, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                feedback.id || randomUUID(),
                this.getPlanId(),
                feedback.title || null,
                feedback.platform || null,
                feedback.content,
                feedback.participants ? JSON.stringify(feedback.participants) : null,
                feedback.createdAt
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to add feedback' 
            };
        }
    }

    // ==================== Checkpoint Operations ====================

    async getCheckpoints(): Promise<StorageResult<Checkpoint[]>> {
        try {
            const rows = this.db.prepare(`
                SELECT name, message, created_at, snapshot
                FROM checkpoints WHERE plan_id = ? ORDER BY created_at DESC
            `).all(this.getPlanId()) as Array<{
                name: string;
                message: string;
                created_at: string;
                snapshot: string;
            }>;

            const checkpoints: Checkpoint[] = rows.map(row => ({
                name: row.name,
                message: row.message,
                createdAt: row.created_at,
                snapshot: JSON.parse(row.snapshot),
            }));

            return { success: true, data: checkpoints };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get checkpoints' 
            };
        }
    }

    async getCheckpoint(name: string): Promise<StorageResult<Checkpoint | null>> {
        try {
            const row = this.db.prepare(`
                SELECT name, message, created_at, snapshot
                FROM checkpoints WHERE plan_id = ? AND name = ?
            `).get(this.getPlanId(), name) as {
                name: string;
                message: string;
                created_at: string;
                snapshot: string;
            } | undefined;

            if (!row) {
                return { success: true, data: null };
            }

            return {
                success: true,
                data: {
                    name: row.name,
                    message: row.message,
                    createdAt: row.created_at,
                    snapshot: JSON.parse(row.snapshot),
                }
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get checkpoint' 
            };
        }
    }

    async createCheckpoint(checkpoint: Checkpoint): Promise<StorageResult<void>> {
        try {
            this.db.prepare(`
                INSERT INTO checkpoints (plan_id, name, message, created_at, snapshot)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(plan_id, name) DO UPDATE SET
                    message = excluded.message,
                    created_at = excluded.created_at,
                    snapshot = excluded.snapshot
            `).run(
                this.getPlanId(),
                checkpoint.name,
                checkpoint.message,
                checkpoint.createdAt,
                JSON.stringify(checkpoint.snapshot)
            );

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to create checkpoint' 
            };
        }
    }

    async restoreCheckpoint(name: string): Promise<StorageResult<void>> {
        try {
            const checkpointResult = await this.getCheckpoint(name);
            if (!checkpointResult.success || !checkpointResult.data) {
                return { success: false, error: `Checkpoint not found: ${name}` };
            }

            const snapshot = checkpointResult.data.snapshot;
            const planId = this.getPlanId();

            // Use a transaction for atomic restore
            const restore = this.db.transaction(() => {
                // Restore metadata
                this.db.prepare(`
                    UPDATE plans SET name = ?, description = ?, stage = ?, updated_at = ?
                    WHERE id = ?
                `).run(
                    snapshot.metadata.name,
                    snapshot.metadata.description || null,
                    snapshot.metadata.stage,
                    new Date().toISOString(),
                    planId
                );

                // Restore step statuses
                for (const step of snapshot.steps) {
                    this.db.prepare(`
                        UPDATE plan_steps SET status = ?, started_at = ?, completed_at = ?
                        WHERE plan_id = ? AND number = ?
                    `).run(
                        step.status,
                        step.startedAt || null,
                        step.completedAt || null,
                        planId,
                        step.number
                    );
                }

                // Restore files
                for (const file of snapshot.files) {
                    this.db.prepare(`
                        INSERT INTO plan_files (plan_id, file_type, filename, content, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(plan_id, file_type, filename) DO UPDATE SET
                            content = excluded.content,
                            updated_at = excluded.updated_at
                    `).run(
                        planId,
                        file.type,
                        file.filename,
                        file.content,
                        new Date().toISOString(),
                        new Date().toISOString()
                    );
                }
            });

            restore();

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to restore checkpoint' 
            };
        }
    }

    // ==================== Search Operations ====================

    async search(query: string): Promise<StorageResult<SearchResult[]>> {
        try {
            const results: SearchResult[] = [];
            const planId = this.getPlanId();
            const searchPattern = `%${query}%`;

            // Search steps
            const stepRows = this.db.prepare(`
                SELECT number, title, content FROM plan_steps
                WHERE plan_id = ? AND (title LIKE ? OR content LIKE ?)
            `).all(planId, searchPattern, searchPattern) as Array<{
                number: number;
                title: string;
                content: string;
            }>;

            for (const row of stepRows) {
                results.push({
                    type: 'step',
                    id: String(row.number),
                    snippet: this.extractSnippet(row.content, query),
                    score: this.calculateScore(row.content, query),
                });
            }

            // Search files
            const fileRows = this.db.prepare(`
                SELECT file_type, filename, content FROM plan_files
                WHERE plan_id = ? AND content LIKE ?
            `).all(planId, searchPattern) as Array<{
                file_type: string;
                filename: string;
                content: string;
            }>;

            for (const row of fileRows) {
                results.push({
                    type: 'file',
                    id: row.filename,
                    snippet: this.extractSnippet(row.content, query),
                    score: this.calculateScore(row.content, query),
                });
            }

            // Search evidence
            const evidenceRows = this.db.prepare(`
                SELECT id, description, content FROM evidence_records
                WHERE plan_id = ? AND (description LIKE ? OR content LIKE ?)
            `).all(planId, searchPattern, searchPattern) as Array<{
                id: string;
                description: string;
                content: string | null;
            }>;

            for (const row of evidenceRows) {
                results.push({
                    type: 'evidence',
                    id: row.id,
                    snippet: this.extractSnippet(row.content || row.description, query),
                    score: this.calculateScore(row.content || row.description, query),
                });
            }

            // Sort by score descending
            results.sort((a, b) => b.score - a.score);

            return { success: true, data: results };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to search' 
            };
        }
    }

    private extractSnippet(content: string, query: string): string {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        
        if (index === -1) {
            return content.slice(0, 100) + '...';
        }

        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + query.length + 50);
        let snippet = content.slice(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        return snippet;
    }

    private calculateScore(content: string, query: string): number {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        // Count occurrences
        let count = 0;
        let pos = 0;
        while ((pos = lowerContent.indexOf(lowerQuery, pos)) !== -1) {
            count++;
            pos += lowerQuery.length;
        }

        // Normalize score (0-1)
        return Math.min(1, count / 10);
    }

    // ==================== Utility Methods ====================

    /**
     * Create a snapshot of the current plan state for checkpoints
     */
    async createSnapshot(): Promise<CheckpointSnapshot> {
        const metadataResult = await this.getMetadata();
        const stepsResult = await this.getSteps();
        const filesResult = await this.getFiles();

        if (!metadataResult.success || !metadataResult.data) {
            throw new Error('Failed to get metadata for snapshot');
        }

        return {
            metadata: metadataResult.data,
            steps: (stepsResult.data || []).map(s => ({
                number: s.number,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            })),
            files: (filesResult.data || []).map(f => ({
                type: f.type,
                filename: f.filename,
                content: f.content,
            })),
        };
    }
}

/**
 * Create a new SQLite storage provider
 */
export function createSqliteProvider(planPath: string): SqliteStorageProvider {
    return new SqliteStorageProvider(planPath);
}
