-- RiotPlan SQLite Schema v1
-- This schema captures all the structure from the directory-based plan format

-- Schema version tracking for migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core plan metadata
CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    stage TEXT NOT NULL DEFAULT 'idea',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    schema_version INTEGER NOT NULL DEFAULT 1
);

-- Plan steps (corresponds to PlanStep interface)
CREATE TABLE IF NOT EXISTS plan_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    content TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, number)
);

-- Plan files (IDEA.md, SHAPING.md, STATUS.md, etc.)
CREATE TABLE IF NOT EXISTS plan_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, file_type, filename)
);

-- Timeline events (corresponds to TimelineEvent interface)
CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON blob
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Evidence records
CREATE TABLE IF NOT EXISTS evidence_records (
    id TEXT PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    gathering_method TEXT,
    content TEXT,
    file_path TEXT,
    relevance_score REAL,
    original_query TEXT,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Feedback records
CREATE TABLE IF NOT EXISTS feedback_records (
    id TEXT PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    title TEXT,
    platform TEXT,
    content TEXT NOT NULL,
    participants TEXT, -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Checkpoints for saving plan state
CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    snapshot TEXT NOT NULL, -- JSON blob of plan state
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, name)
);

-- Step reflections
CREATE TABLE IF NOT EXISTS step_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    reflection TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, step_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_uuid ON plans(uuid);
CREATE INDEX IF NOT EXISTS idx_steps_plan_number ON plan_steps(plan_id, number);
CREATE INDEX IF NOT EXISTS idx_files_plan_type ON plan_files(plan_id, file_type);
CREATE INDEX IF NOT EXISTS idx_timeline_plan_time ON timeline_events(plan_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_timeline_type ON timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_evidence_plan ON evidence_records(plan_id);
CREATE INDEX IF NOT EXISTS idx_feedback_plan ON feedback_records(plan_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_plan ON checkpoints(plan_id);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
