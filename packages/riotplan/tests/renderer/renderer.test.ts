/**
 * Tests for riotplan-renderer
 */

import { describe, it, expect } from "vitest";
import type { Plan } from "../../src/types.js";
import {
  renderPlan,
  renderToMarkdown,
  renderToJson,
  renderToHtml,
} from "../../src/index.js";

// Mock plan for testing
const mockPlan: Plan = {
  metadata: {
    code: "test-plan",
    name: "Test Plan",
    description: "A test plan for rendering",
    author: "Test Author",
    createdAt: new Date("2026-01-14"),
    path: "/test/plan",
  },
  files: {
    summary: "SUMMARY.md",
    status: "STATUS.md",
    steps: ["01-setup.md", "02-implementation.md", "03-testing.md"],
    subdirectories: [],
  },
  steps: [
    {
      number: 1,
      code: "setup",
      filename: "01-setup.md",
      title: "Setup",
      description: "Initial setup",
      status: "completed",
      startedAt: new Date("2026-01-14T09:00:00Z"),
      completedAt: new Date("2026-01-14T10:00:00Z"),
      filePath: "/test/plan/01-setup.md",
    },
    {
      number: 2,
      code: "implementation",
      filename: "02-implementation.md",
      title: "Implementation",
      description: "Core implementation work",
      status: "in_progress",
      startedAt: new Date("2026-01-14T10:00:00Z"),
      filePath: "/test/plan/02-implementation.md",
    },
    {
      number: 3,
      code: "testing",
      filename: "03-testing.md",
      title: "Testing",
      description: "Verify everything works",
      status: "pending",
      filePath: "/test/plan/03-testing.md",
    },
  ],
  state: {
    status: "in_progress",
    progress: 50,
    currentStep: 2,
    lastUpdatedAt: new Date("2026-01-14"),
    blockers: [],
    issues: [],
  },
  context: "test-context",
  feedback: [
    {
      id: "feedback-001",
      title: "Looks good!",
      platform: "slack",
      createdAt: new Date("2026-01-14T10:00:00Z"),
      participants: [],
    },
  ],
  evidence: [
    {
      id: "evidence-001",
      type: "screenshot",
      title: "Test screenshot",
      source: "test.png",
      filename: "evidence-001.md",
      createdAt: new Date("2026-01-14T10:00:00Z"),
    },
  ],
};

describe("riotplan-renderer", () => {
  describe("renderPlan", () => {
    it("should render to markdown format", () => {
      const result = renderPlan(mockPlan, { format: "markdown" });

      expect(result.success).toBe(true);
      expect(result.format).toBe("markdown");
      expect(result.content).toContain("# Test Plan");
    });

    it("should render to json format", () => {
      const result = renderPlan(mockPlan, { format: "json" });

      expect(result.success).toBe(true);
      expect(result.format).toBe("json");
      expect(result.content).toBeDefined();

      const parsed = JSON.parse(result.content!);
      expect(parsed.metadata.code).toBe("test-plan");
    });

    it("should render to html format", () => {
      const result = renderPlan(mockPlan, { format: "html" });

      expect(result.success).toBe(true);
      expect(result.format).toBe("html");
      expect(result.content).toContain("<!DOCTYPE html>");
      expect(result.content).toContain("Test Plan");
    });

    it("should return error for unknown format", () => {
      const result = renderPlan(mockPlan, {
        format: "unknown" as "markdown",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown format");
    });
  });

  describe("renderToMarkdown", () => {
    it("should render basic markdown", () => {
      const content = renderToMarkdown(mockPlan);

      expect(content).toContain("# Test Plan");
      expect(content).toContain("## Metadata");
      expect(content).toContain("## Status Overview");
      expect(content).toContain("## Steps");
    });

    it("should include metadata when requested", () => {
      const content = renderToMarkdown(mockPlan, {
        includeMetadata: true,
      });

      expect(content).toContain("test-plan");
      expect(content).toContain("Test Author");
    });

    it("should exclude metadata when not requested", () => {
      const content = renderToMarkdown(mockPlan, {
        includeMetadata: false,
      });

      expect(content).not.toContain("## Metadata");
    });

    it("should render steps as table by default", () => {
      const content = renderToMarkdown(mockPlan);

      expect(content).toContain("| # | Title |");
      expect(content).toContain("| 1 | Setup |");
    });

    it("should render steps as task list when requested", () => {
      const content = renderToMarkdown(mockPlan, { useTaskList: true });

      expect(content).toContain("- [x] **1. Setup**");
      expect(content).toContain("- [ ] **2. Implementation**");
    });

    it("should include table of contents when requested", () => {
      const content = renderToMarkdown(mockPlan, { includeToc: true });

      expect(content).toContain("## Table of Contents");
      expect(content).toContain("- [Status Overview]");
    });

    it("should include feedback when requested", () => {
      const content = renderToMarkdown(mockPlan, {
        includeFeedback: true,
      });

      expect(content).toContain("## Feedback");
      expect(content).toContain("feedback-001");
    });

    it("should include evidence when requested", () => {
      const content = renderToMarkdown(mockPlan, {
        includeEvidence: true,
      });

      expect(content).toContain("## Evidence");
      expect(content).toContain("evidence-001");
    });
  });

  describe("renderToJson", () => {
    it("should render valid JSON", () => {
      const content = renderToJson(mockPlan);
      const parsed = JSON.parse(content);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.status).toBeDefined();
      expect(parsed.steps).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });

    it("should pretty print by default", () => {
      const content = renderToJson(mockPlan);

      expect(content).toContain("\n");
      expect(content).toContain("  ");
    });

    it("should compact when pretty is false", () => {
      const content = renderToJson(mockPlan, { pretty: false });

      expect(content).not.toContain("\n");
    });

    it("should include feedback by default", () => {
      const content = renderToJson(mockPlan);
      const parsed = JSON.parse(content);

      expect(parsed.feedback).toBeDefined();
      expect(parsed.feedback.length).toBe(1);
    });

    it("should exclude feedback when requested", () => {
      const content = renderToJson(mockPlan, { includeFeedback: false });
      const parsed = JSON.parse(content);

      expect(parsed.feedback).toBeUndefined();
    });

    it("should filter fields when specified", () => {
      const content = renderToJson(mockPlan, {
        fields: ["metadata", "status"],
      });
      const parsed = JSON.parse(content);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.status).toBeDefined();
      expect(parsed.steps).toBeUndefined();
    });
  });

  describe("renderToHtml", () => {
    it("should render full HTML document by default", () => {
      const content = renderToHtml(mockPlan);

      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("<head>");
      expect(content).toContain("<body>");
    });

    it("should render only content when fullDocument is false", () => {
      const content = renderToHtml(mockPlan, { fullDocument: false });

      expect(content).not.toContain("<!DOCTYPE html>");
      expect(content).toContain("<header>");
    });

    it("should include styles by default", () => {
      const content = renderToHtml(mockPlan);

      expect(content).toContain("<style>");
    });

    it("should exclude styles when not requested", () => {
      const content = renderToHtml(mockPlan, { includeStyles: false });

      expect(content).not.toContain("<style>");
    });

    it("should use light theme by default", () => {
      const content = renderToHtml(mockPlan);

      expect(content).toContain("#ffffff"); // light background
    });

    it("should use dark theme when requested", () => {
      const content = renderToHtml(mockPlan, { theme: "dark" });

      expect(content).toContain("#1a1a1a"); // dark background
    });

    it("should render steps", () => {
      const content = renderToHtml(mockPlan);

      expect(content).toContain("Setup");
      expect(content).toContain("Implementation");
      expect(content).toContain("Testing");
    });

    it("should include feedback when requested", () => {
      const content = renderToHtml(mockPlan, { includeFeedback: true });

      expect(content).toContain("Feedback");
      expect(content).toContain("feedback-001");
    });

    it("should include evidence when requested", () => {
      const content = renderToHtml(mockPlan, { includeEvidence: true });

      expect(content).toContain("Evidence");
      expect(content).toContain("evidence-001");
    });

    it("should escape HTML entities", () => {
      const planWithHtml: Plan = {
        ...mockPlan,
        metadata: {
          ...mockPlan.metadata,
          name: "<script>alert('xss')</script>",
        },
      };

      const content = renderToHtml(planWithHtml);

      expect(content).toContain("&lt;script&gt;");
      expect(content).not.toContain("<script>alert");
    });
  });
});
