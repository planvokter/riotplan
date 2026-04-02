/**
 * Tests for STATUS.md Parser
 */

import { describe, it, expect } from "vitest";
import { parseStatus } from "../src/index.js";

describe("parseStatus", () => {
    const sampleStatus = `# My Plan Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | 🔄 IN_PROGRESS |
| **Current Step** | 03 |
| **Last Completed** | 02 |
| **Started** | 2026-01-10 |
| **Last Updated** | 2026-01-14 |
| **Progress** | 40% (2/5 steps) |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Setup | ✅ | 2026-01-10 | 2026-01-10 | |
| 02 | Foundation | ✅ | 2026-01-11 | 2026-01-12 | |
| 03 | Core | 🔄 | 2026-01-13 | - | In progress |
| 04 | Testing | ⬜ | - | - | |
| 05 | Release | ⬜ | - | - | |

## Blockers

- Waiting on dependency X

## Issues

None currently.

## Notes

Additional notes here.
`;

    describe("current state parsing", () => {
        it("should parse status from emoji", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.currentState.status).toBe("in_progress");
        });

        it("should parse current step", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.currentState.currentStep).toBe("03");
        });

        it("should parse last completed", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.currentState.lastCompleted).toBe("02");
        });

        it("should parse started date", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.currentState.startedAt).toBe("2026-01-10");
        });

        it("should parse last updated date", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.currentState.lastUpdated).toBe("2026-01-14");
        });
    });

    describe("step progress parsing", () => {
        it("should parse all steps", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.stepProgress.length).toBe(5);
        });

        it("should parse step statuses correctly", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.stepProgress[0].status).toBe("completed");
            expect(result.document.stepProgress[1].status).toBe("completed");
            expect(result.document.stepProgress[2].status).toBe("in_progress");
            expect(result.document.stepProgress[3].status).toBe("pending");
            expect(result.document.stepProgress[4].status).toBe("pending");
        });

        it("should parse step names", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.stepProgress[0].name).toBe("Setup");
            expect(result.document.stepProgress[2].name).toBe("Core");
        });

        it("should parse step dates", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.stepProgress[0].started).toBe("2026-01-10");
            expect(result.document.stepProgress[0].completed).toBe("2026-01-10");
            expect(result.document.stepProgress[3].started).toBeUndefined();
        });

        it("should parse step notes", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.stepProgress[2].notes).toBe("In progress");
            expect(result.document.stepProgress[0].notes).toBeUndefined();
        });
    });

    describe("blockers parsing", () => {
        it("should parse blockers list", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.blockers.length).toBe(1);
            expect(result.document.blockers[0]).toContain("dependency X");
        });

        it("should handle no blockers", () => {
            const noBlockers = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |

## Blockers

None currently.
`;
            const result = parseStatus(noBlockers);
            expect(result.document.blockers).toEqual([]);
        });

        it("should handle multiple blockers", () => {
            const multiBlockers = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⏸️ BLOCKED |

## Blockers

- Blocker 1
- Blocker 2
- Blocker 3
`;
            const result = parseStatus(multiBlockers);
            expect(result.document.blockers.length).toBe(3);
        });
    });

    describe("issues parsing", () => {
        it("should handle no issues", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.issues).toEqual([]);
        });

        it("should parse issues list", () => {
            const withIssues = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | 🔄 IN_PROGRESS |

## Issues

- Issue 1: Something went wrong
- Issue 2: Another problem
`;
            const result = parseStatus(withIssues);
            expect(result.document.issues.length).toBe(2);
            expect(result.document.issues[0]).toContain("Issue 1");
        });
    });

    describe("notes parsing", () => {
        it("should parse notes section", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.notes).toBe("Additional notes here.");
        });

        it("should handle missing notes", () => {
            const noNotes = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |
`;
            const result = parseStatus(noNotes);
            expect(result.document.notes).toBeUndefined();
        });
    });

    describe("progress calculation", () => {
        it("should calculate progress correctly", () => {
            const result = parseStatus(sampleStatus);
            expect(result.state.progress).toBe(40);
        });

        it("should handle 0% progress", () => {
            const noProgress = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |

## Step Progress

| Step | Name | Status |
|------|------|--------|
| 01 | Step 1 | ⬜ |
| 02 | Step 2 | ⬜ |
`;
            const result = parseStatus(noProgress);
            expect(result.state.progress).toBe(0);
        });

        it("should handle 100% progress", () => {
            const allComplete = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ✅ COMPLETED |

## Step Progress

| Step | Name | Status |
|------|------|--------|
| 01 | Step 1 | ✅ |
| 02 | Step 2 | ✅ |
`;
            const result = parseStatus(allComplete);
            expect(result.state.progress).toBe(100);
        });
    });

    describe("state derivation", () => {
        it("should derive state from document", () => {
            const result = parseStatus(sampleStatus);
            expect(result.state.status).toBe("in_progress");
            expect(result.state.blockers.length).toBe(1);
            expect(result.state.issues.length).toBe(0);
        });

        it("should set started date in state", () => {
            const result = parseStatus(sampleStatus);
            expect(result.state.startedAt).toBeInstanceOf(Date);
        });

        it("should set last updated date in state", () => {
            const result = parseStatus(sampleStatus);
            expect(result.state.lastUpdatedAt).toBeInstanceOf(Date);
        });
    });

    describe("cross-reference with steps", () => {
        it("should extract step numbers when steps provided", () => {
            const steps = [
                { number: 1, code: "setup", filename: "01-setup.md", title: "Setup", status: "pending" as const, filePath: "" },
                { number: 2, code: "foundation", filename: "02-foundation.md", title: "Foundation", status: "pending" as const, filePath: "" },
                { number: 3, code: "core", filename: "03-core.md", title: "Core", status: "pending" as const, filePath: "" },
                { number: 4, code: "testing", filename: "04-testing.md", title: "Testing", status: "pending" as const, filePath: "" },
                { number: 5, code: "release", filename: "05-release.md", title: "Release", status: "pending" as const, filePath: "" },
            ];

            const result = parseStatus(sampleStatus, { steps });
            expect(result.state.currentStep).toBe(3);
            expect(result.state.lastCompletedStep).toBe(2);
        });

        it("should warn on step count mismatch", () => {
            const steps = [
                { number: 1, code: "step", filename: "01-step.md", title: "Step", status: "pending" as const, filePath: "" },
            ];

            const result = parseStatus(sampleStatus, { steps });
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain("mismatch");
        });
    });

    describe("format variations", () => {
        it("should handle text status instead of emoji", () => {
            const textStatus = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | IN_PROGRESS |
`;
            const result = parseStatus(textStatus);
            expect(result.document.currentState.status).toBe("in_progress");
        });

        it("should handle COMPLETED text", () => {
            const completed = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | COMPLETED |
`;
            const result = parseStatus(completed);
            expect(result.document.currentState.status).toBe("completed");
        });

        it("should handle BLOCKED text", () => {
            const blocked = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | BLOCKED |
`;
            const result = parseStatus(blocked);
            expect(result.document.currentState.status).toBe("blocked");
        });

        it("should handle missing sections gracefully", () => {
            const minimal = `# Plan Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |
`;

            const result = parseStatus(minimal);
            expect(result.document.currentState.status).toBe("pending");
            expect(result.document.stepProgress).toEqual([]);
            expect(result.document.blockers).toEqual([]);
            expect(result.document.issues).toEqual([]);
            expect(result.warnings.length).toBe(0);
        });

        it("should handle dash placeholders", () => {
            const withDashes = `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |
| **Current Step** | - |
| **Last Completed** | - |
| **Started** | - |
`;
            const result = parseStatus(withDashes);
            expect(result.document.currentState.currentStep).toBeUndefined();
            expect(result.document.currentState.lastCompleted).toBeUndefined();
            expect(result.document.currentState.startedAt).toBeUndefined();
        });
    });

    describe("title extraction", () => {
        it("should extract title from first heading", () => {
            const result = parseStatus(sampleStatus);
            expect(result.document.title).toBe("My Plan Status");
        });

        it("should use default title if no heading", () => {
            const noTitle = `## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |
`;
            const result = parseStatus(noTitle);
            expect(result.document.title).toBe("Unknown Plan");
        });
    });

    describe("all status types", () => {
        it("should parse pending status", () => {
            const pending = `# Status
## Current State
| Field | Value |
|-------|-------|
| **Status** | ⬜ PENDING |
`;
            expect(parseStatus(pending).state.status).toBe("pending");
        });

        it("should parse failed status", () => {
            const failed = `# Status
## Current State
| Field | Value |
|-------|-------|
| **Status** | ❌ FAILED |
`;
            expect(parseStatus(failed).state.status).toBe("failed");
        });

        it("should parse blocked status", () => {
            const blocked = `# Status
## Current State
| Field | Value |
|-------|-------|
| **Status** | ⏸️ BLOCKED |
`;
            expect(parseStatus(blocked).state.status).toBe("blocked");
        });

        it("should parse skipped status", () => {
            const skipped = `# Status
## Current State
| Field | Value |
|-------|-------|
| **Status** | ⏭️ SKIPPED |
`;
            expect(parseStatus(skipped).state.status).toBe("skipped");
        });
    });
});

