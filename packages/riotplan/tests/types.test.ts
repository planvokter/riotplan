/**
 * Tests for RiotPlan types
 */

import { describe, it, expect } from 'vitest';
import type {
  TaskStatus,
  Priority,
  // New feedback types
  FeedbackPlatform,
  FeedbackParticipant,
  FeedbackContext,
  FeedbackRecord,
  // New evidence types
  EvidenceType,
  EvidenceRecord,
  // New revision/history types
  PlanRevision,
  PlanMilestone,
  PlanHistory,
  // New context types
  ContextId,
  PlanContextDefinition,
  // New relationship types
  RelationshipType,
  PlanRelationship,
  // Existing types
  PlanStep,
  PlanPhase,
  Blocker,
  Issue,
  PlanMetadata,
  PlanFiles,
  PlanState,
  Plan,
  PlanContext,
  StepResult,
  PlanResult,
  StatusDocument,
  ExecutionPlanDocument,
} from '../src/types.js';
import { PLAN_CONVENTIONS } from '../src/types.js';

describe('TaskStatus type', () => {
  it('should accept valid status values', () => {
    const statuses: TaskStatus[] = [
      'pending',
      'in_progress',
      'completed',
      'failed',
      'blocked',
      'skipped',
    ];
    expect(statuses).toHaveLength(6);
  });
});

describe('Priority type', () => {
  it('should accept valid priority values', () => {
    const priorities: Priority[] = ['high', 'medium', 'low'];
    expect(priorities).toHaveLength(3);
  });
});

describe('PlanStep interface', () => {
  it('should create a valid plan step', () => {
    const step: PlanStep = {
      number: 1,
      code: 'execution-interfaces',
      filename: '01-execution-interfaces.md',
      title: 'Execution Interfaces',
      description: 'Define provider interfaces',
      status: 'pending',
      dependencies: [],
      filePath: '/path/to/plan/01-execution-interfaces.md',
    };
    expect(step.number).toBe(1);
    expect(step.code).toBe('execution-interfaces');
    expect(step.status).toBe('pending');
  });

  it('should support optional fields', () => {
    const step: PlanStep = {
      number: 2,
      code: 'implementation',
      filename: '02-implementation.md',
      title: 'Implementation',
      status: 'completed',
      filePath: '/path/to/plan/02-implementation.md',
      startedAt: new Date('2026-01-10'),
      completedAt: new Date('2026-01-10'),
      duration: 3600000,
      notes: 'Completed successfully',
    };
    expect(step.startedAt).toBeInstanceOf(Date);
    expect(step.completedAt).toBeInstanceOf(Date);
    expect(step.duration).toBe(3600000);
    expect(step.notes).toBe('Completed successfully');
  });
});

describe('PlanPhase interface', () => {
  it('should create a valid plan phase', () => {
    const phase: PlanPhase = {
      number: 1,
      name: 'Infrastructure',
      description: 'Setup project structure',
      steps: [1, 2, 3],
      status: 'in_progress',
      estimatedDuration: '2 days',
    };
    expect(phase.number).toBe(1);
    expect(phase.steps).toEqual([1, 2, 3]);
    expect(phase.status).toBe('in_progress');
  });
});

describe('Blocker interface', () => {
  it('should create a valid blocker', () => {
    const blocker: Blocker = {
      id: 'blocker-1',
      description: 'Waiting for API access',
      severity: 'high',
      affectedSteps: [3, 4, 5],
      createdAt: new Date('2026-01-10'),
    };
    expect(blocker.id).toBe('blocker-1');
    expect(blocker.severity).toBe('high');
    expect(blocker.affectedSteps).toHaveLength(3);
  });

  it('should support resolution fields', () => {
    const blocker: Blocker = {
      id: 'blocker-2',
      description: 'Missing dependency',
      severity: 'medium',
      affectedSteps: [2],
      createdAt: new Date('2026-01-09'),
      resolvedAt: new Date('2026-01-10'),
      resolution: 'Installed missing package',
    };
    expect(blocker.resolvedAt).toBeInstanceOf(Date);
    expect(blocker.resolution).toBe('Installed missing package');
  });
});

describe('Issue interface', () => {
  it('should create a valid issue', () => {
    const issue: Issue = {
      id: 'issue-1',
      title: 'Build failure',
      description: 'TypeScript compilation error',
      severity: 'high',
      step: 3,
      createdAt: new Date('2026-01-10'),
    };
    expect(issue.id).toBe('issue-1');
    expect(issue.title).toBe('Build failure');
    expect(issue.step).toBe(3);
  });
});

describe('PlanMetadata interface', () => {
  it('should create valid plan metadata', () => {
    const metadata: PlanMetadata = {
      code: 'big-splitup',
      name: 'RiotPrompt Split-Up',
      description: 'Split monolith into modular packages',
      version: '1.0.0',
      author: 'developer',
      tags: ['refactoring', 'modular'],
      createdAt: new Date('2026-01-10'),
      path: '/path/to/plan',
    };
    expect(metadata.code).toBe('big-splitup');
    expect(metadata.name).toBe('RiotPrompt Split-Up');
    expect(metadata.tags).toContain('refactoring');
  });
});

describe('PlanFiles interface', () => {
  it('should create valid plan files structure', () => {
    const files: PlanFiles = {
      metaPrompt: 'big-splitup-prompt.md',
      summary: 'SUMMARY.md',
      status: 'STATUS.md',
      executionPlan: 'EXECUTION_PLAN.md',
      steps: [
        '01-execution-interfaces.md',
        '02-execution-providers.md',
        '03-agentic-extraction.md',
      ],
      subdirectories: ['plan', 'analysis'],
    };
    expect(files.steps).toHaveLength(3);
    expect(files.subdirectories).toContain('plan');
  });
});

describe('PlanState interface', () => {
  it('should create valid plan state', () => {
    const state: PlanState = {
      status: 'in_progress',
      currentStep: 3,
      lastCompletedStep: 2,
      startedAt: new Date('2026-01-10'),
      lastUpdatedAt: new Date('2026-01-10'),
      blockers: [],
      issues: [],
      progress: 27,
    };
    expect(state.status).toBe('in_progress');
    expect(state.currentStep).toBe(3);
    expect(state.progress).toBe(27);
  });
});

describe('Plan interface', () => {
  it('should create a complete plan', () => {
    const plan: Plan = {
      metadata: {
        code: 'test-plan',
        name: 'Test Plan',
        path: '/path/to/plan',
      },
      files: {
        steps: ['01-step.md'],
        subdirectories: [],
      },
      steps: [
        {
          number: 1,
          code: 'step',
          filename: '01-step.md',
          title: 'First Step',
          status: 'pending',
          filePath: '/path/to/plan/01-step.md',
        },
      ],
      state: {
        status: 'pending',
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 0,
      },
    };
    expect(plan.metadata.code).toBe('test-plan');
    expect(plan.steps).toHaveLength(1);
    expect(plan.state.status).toBe('pending');
  });
});

describe('StepResult interface', () => {
  it('should create a successful step result', () => {
    const result: StepResult = {
      success: true,
      step: 1,
      output: 'Step completed successfully',
      duration: 5000,
      artifacts: ['dist/index.js', 'dist/types.d.ts'],
    };
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(2);
  });

  it('should create a failed step result', () => {
    const result: StepResult = {
      success: false,
      step: 2,
      error: new Error('Build failed'),
      duration: 1000,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('PlanResult interface', () => {
  it('should create a plan result', () => {
    const result: PlanResult = {
      success: true,
      executedSteps: [1, 2, 3],
      completedSteps: [1, 2],
      failedSteps: [],
      skippedSteps: [3],
      duration: 60000,
      finalState: {
        status: 'completed',
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 100,
      },
    };
    expect(result.success).toBe(true);
    expect(result.executedSteps).toHaveLength(3);
    expect(result.completedSteps).toHaveLength(2);
  });
});

describe('StatusDocument interface', () => {
  it('should create a status document', () => {
    const doc: StatusDocument = {
      title: 'Test Plan - Execution Status',
      currentState: {
        status: 'in_progress',
        currentStep: '02-implementation',
        lastCompleted: '01-setup',
        startedAt: '2026-01-10',
        lastUpdated: '2026-01-10',
      },
      stepProgress: [
        {
          step: '01',
          name: 'Setup',
          status: 'completed',
          started: '2026-01-10',
          completed: '2026-01-10',
        },
        {
          step: '02',
          name: 'Implementation',
          status: 'in_progress',
          started: '2026-01-10',
        },
      ],
      blockers: [],
      issues: [],
    };
    expect(doc.title).toBe('Test Plan - Execution Status');
    expect(doc.stepProgress).toHaveLength(2);
  });
});

describe('ExecutionPlanDocument interface', () => {
  it('should create an execution plan document', () => {
    const doc: ExecutionPlanDocument = {
      strategy: 'Incremental implementation with testing',
      prerequisites: ['Node.js 22+', 'npm 10+'],
      phases: [
        {
          name: 'Phase 1: Setup',
          description: 'Initialize project structure',
          steps: ['01-setup', '02-config'],
        },
        {
          name: 'Phase 2: Implementation',
          description: 'Build core functionality',
          steps: ['03-core', '04-api'],
        },
      ],
      qualityGates: ['All tests pass', 'No lint errors'],
      rollback: 'Revert to previous version',
    };
    expect(doc.phases).toHaveLength(2);
    expect(doc.prerequisites).toContain('Node.js 22+');
  });
});

// ===== NEW TYPE TESTS (Step 01) =====

describe('FeedbackRecord interface', () => {
  it('should create a valid feedback record', () => {
    const feedback: FeedbackRecord = {
      id: '001',
      title: 'Initial Review',
      createdAt: new Date('2026-01-10'),
      participants: [
        { name: 'Tim', type: 'human' },
        { name: 'Claude', type: 'ai', model: 'claude-sonnet-4-20250514' }
      ],
      platform: 'cursor',
      feedback: 'Consider adding feedback capture to the plan',
      filename: '001-initial-review.md'
    };
    expect(feedback.id).toBe('001');
    expect(feedback.title).toBe('Initial Review');
    expect(feedback.participants).toHaveLength(2);
    expect(feedback.platform).toBe('cursor');
  });

  it('should support all optional fields', () => {
    const feedback: FeedbackRecord = {
      id: '002',
      title: 'Architecture Discussion',
      createdAt: new Date('2026-01-11'),
      participants: [
        { name: 'Developer', type: 'human' }
      ],
      platform: 'meeting',
      planVersion: '0.2',
      context: [
        { file: 'src/types.ts', startLine: 10, endLine: 50 }
      ],
      proposed: 'Original approach using single file',
      feedback: 'Should split into multiple modules',
      discussion: 'Team discussed pros and cons...',
      resolution: 'Agreed to modular approach',
      changes: ['Created src/feedback.ts', 'Updated exports'],
      openQuestions: ['How to handle migration?'],
      filename: '002-architecture-discussion.md'
    };
    expect(feedback.planVersion).toBe('0.2');
    expect(feedback.context).toHaveLength(1);
    expect(feedback.changes).toHaveLength(2);
    expect(feedback.openQuestions).toHaveLength(1);
  });
});

describe('FeedbackPlatform type', () => {
  it('should accept all valid platform values', () => {
    const platforms: FeedbackPlatform[] = [
      'cursor', 'chatgpt', 'slack', 'email', 'meeting', 'voice', 'document', 'other'
    ];
    expect(platforms).toHaveLength(8);
  });
});

describe('FeedbackParticipant interface', () => {
  it('should create human participant', () => {
    const human: FeedbackParticipant = {
      name: 'Developer',
      type: 'human'
    };
    expect(human.type).toBe('human');
    expect(human.model).toBeUndefined();
  });

  it('should create AI participant with model', () => {
    const ai: FeedbackParticipant = {
      name: 'Claude',
      type: 'ai',
      model: 'claude-sonnet-4-20250514'
    };
    expect(ai.type).toBe('ai');
    expect(ai.model).toBe('claude-sonnet-4-20250514');
  });
});

describe('FeedbackContext interface', () => {
  it('should create file context with line numbers', () => {
    const context: FeedbackContext = {
      file: 'src/types.ts',
      startLine: 100,
      endLine: 150,
      content: 'export interface Plan { ... }'
    };
    expect(context.file).toBe('src/types.ts');
    expect(context.startLine).toBe(100);
    expect(context.endLine).toBe(150);
  });

  it('should create minimal file context', () => {
    const context: FeedbackContext = {
      file: 'README.md'
    };
    expect(context.file).toBe('README.md');
    expect(context.startLine).toBeUndefined();
  });
});

describe('EvidenceRecord interface', () => {
  it('should create a valid evidence record', () => {
    const evidence: EvidenceRecord = {
      id: 'ev-001',
      type: 'case-study',
      title: 'What happened in project X',
      createdAt: new Date('2026-01-10'),
      filename: 'what-happened-in-project-x.md'
    };
    expect(evidence.id).toBe('ev-001');
    expect(evidence.type).toBe('case-study');
  });

  it('should support all evidence types', () => {
    const types: EvidenceType[] = [
      'case-study', 'research', 'analysis', 'example', 'external-review', 'reference'
    ];
    expect(types).toHaveLength(6);
  });

  it('should support all optional fields', () => {
    const evidence: EvidenceRecord = {
      id: 'ev-002',
      type: 'research',
      title: 'Research on best practices',
      createdAt: new Date('2026-01-11'),
      source: 'https://example.com/article',
      filename: 'research-best-practices.md',
      summary: 'Key findings from research...',
      tags: ['best-practices', 'architecture']
    };
    expect(evidence.source).toBe('https://example.com/article');
    expect(evidence.tags).toHaveLength(2);
  });
});

describe('PlanRevision interface', () => {
  it('should create a valid plan revision', () => {
    const revision: PlanRevision = {
      version: '0.1',
      createdAt: new Date('2026-01-10')
    };
    expect(revision.version).toBe('0.1');
  });

  it('should support all optional fields', () => {
    const revision: PlanRevision = {
      version: '0.2',
      createdAt: new Date('2026-01-11'),
      message: 'Updated based on feedback',
      author: 'developer',
      feedbackId: '001'
    };
    expect(revision.message).toBe('Updated based on feedback');
    expect(revision.feedbackId).toBe('001');
  });
});

describe('PlanMilestone interface', () => {
  it('should create a valid milestone', () => {
    const milestone: PlanMilestone = {
      name: 'Phase 1 Complete',
      version: '1.0',
      createdAt: new Date('2026-01-15'),
      description: 'Core functionality implemented'
    };
    expect(milestone.name).toBe('Phase 1 Complete');
    expect(milestone.version).toBe('1.0');
  });
});

describe('PlanHistory interface', () => {
  it('should create a valid plan history', () => {
    const history: PlanHistory = {
      revisions: [
        { version: '0.1', createdAt: new Date('2026-01-10') },
        { version: '0.2', createdAt: new Date('2026-01-11') }
      ],
      currentVersion: '0.2'
    };
    expect(history.revisions).toHaveLength(2);
    expect(history.currentVersion).toBe('0.2');
  });

  it('should support milestones', () => {
    const history: PlanHistory = {
      revisions: [
        { version: '1.0', createdAt: new Date('2026-01-15') }
      ],
      currentVersion: '1.0',
      milestones: [
        { name: 'v1.0 Release', version: '1.0', createdAt: new Date('2026-01-15') }
      ]
    };
    expect(history.milestones).toHaveLength(1);
  });
});

describe('PlanContextDefinition interface', () => {
  it('should create a simple context', () => {
    const context: PlanContextDefinition = {
      id: 'work',
      name: 'Work Projects'
    };
    expect(context.id).toBe('work');
    expect(context.name).toBe('Work Projects');
  });

  it('should support hierarchical contexts', () => {
    const context: PlanContextDefinition = {
      id: 'work/kjerneverk',
      name: 'Kjerneverk',
      parent: 'work',
      isDefault: true
    };
    expect(context.parent).toBe('work');
    expect(context.isDefault).toBe(true);
  });
});

describe('ContextId type', () => {
  it('should accept string context identifiers', () => {
    const ids: ContextId[] = ['work', 'personal', 'work/kjerneverk'];
    expect(ids).toHaveLength(3);
  });
});

describe('PlanRelationship interface', () => {
  it('should create a spawned-from relationship', () => {
    const relationship: PlanRelationship = {
      type: 'spawned-from',
      planPath: '../parent-plan',
      createdAt: new Date('2026-01-10')
    };
    expect(relationship.type).toBe('spawned-from');
    expect(relationship.planPath).toBe('../parent-plan');
  });

  it('should support all relationship types', () => {
    const types: RelationshipType[] = [
      'spawned-from', 'spawned', 'blocks', 'blocked-by', 'related'
    ];
    expect(types).toHaveLength(5);
  });

  it('should support optional fields', () => {
    const relationship: PlanRelationship = {
      type: 'blocks',
      planPath: '../dependent-plan',
      steps: [3, 4],
      reason: 'Waiting for API implementation',
      createdAt: new Date('2026-01-10')
    };
    expect(relationship.steps).toEqual([3, 4]);
    expect(relationship.reason).toBe('Waiting for API implementation');
  });
});

describe('Extended Plan interface', () => {
  it('should support feedback, evidence, history, and relationships', () => {
    const plan: Plan = {
      metadata: {
        code: 'test-plan',
        name: 'Test Plan',
        path: '/path/to/plan',
      },
      files: {
        steps: ['01-step.md'],
        subdirectories: [],
        feedbackDir: 'feedback',
        feedbackFiles: ['001-initial-review.md'],
        evidenceDir: 'evidence',
        evidenceFiles: ['what-happened-in-project-x.md'],
        historyDir: '.history',
        changelog: 'CHANGELOG.md',
      },
      steps: [
        {
          number: 1,
          code: 'step',
          filename: '01-step.md',
          title: 'First Step',
          status: 'pending',
          filePath: '/path/to/plan/01-step.md',
        },
      ],
      state: {
        status: 'pending',
        lastUpdatedAt: new Date(),
        blockers: [],
        issues: [],
        progress: 0,
      },
      feedback: [
        {
          id: '001',
          title: 'Initial Review',
          createdAt: new Date(),
          participants: [{ name: 'Dev', type: 'human' }],
          platform: 'cursor',
          feedback: 'Looks good',
          filename: '001-initial-review.md',
        }
      ],
      evidence: [
        {
          id: 'ev-001',
          type: 'case-study',
          title: 'Case Study',
          createdAt: new Date(),
          filename: 'case-study.md',
        }
      ],
      history: {
        revisions: [{ version: '0.1', createdAt: new Date() }],
        currentVersion: '0.1',
      },
      context: 'work/kjerneverk',
      relationships: [
        { type: 'spawned-from', planPath: '../parent', createdAt: new Date() }
      ],
    };
    expect(plan.feedback).toHaveLength(1);
    expect(plan.evidence).toHaveLength(1);
    expect(plan.history?.currentVersion).toBe('0.1');
    expect(plan.context).toBe('work/kjerneverk');
    expect(plan.relationships).toHaveLength(1);
  });
});

describe('Extended PlanFiles interface', () => {
  it('should include new file/directory fields', () => {
    const files: PlanFiles = {
      metaPrompt: 'plan-prompt.md',
      steps: ['01-step.md'],
      subdirectories: ['plan'],
      feedbackDir: 'feedback',
      feedbackFiles: ['001-review.md', '002-discussion.md'],
      evidenceDir: 'evidence',
      evidenceFiles: ['research-topic.md'],
      historyDir: '.history',
      changelog: 'CHANGELOG.md',
    };
    expect(files.feedbackDir).toBe('feedback');
    expect(files.feedbackFiles).toHaveLength(2);
    expect(files.evidenceDir).toBe('evidence');
    expect(files.historyDir).toBe('.history');
    expect(files.changelog).toBe('CHANGELOG.md');
  });
});

describe('PLAN_CONVENTIONS', () => {
  it('should have meta-prompt patterns', () => {
    expect(PLAN_CONVENTIONS.metaPromptPatterns).toContain('{code}-prompt.md');
    expect(PLAN_CONVENTIONS.metaPromptPatterns).toContain('prompt-of-prompts.md');
  });

  it('should have step pattern regex', () => {
    const pattern = PLAN_CONVENTIONS.stepPattern;
    expect(pattern.test('01-setup.md')).toBe(true);
    expect(pattern.test('02-implementation.md')).toBe(true);
    expect(pattern.test('11-final.md')).toBe(true);
    expect(pattern.test('setup.md')).toBe(false);
    expect(pattern.test('1-setup.md')).toBe(false);
  });

  it('should have feedback pattern regex', () => {
    const pattern = PLAN_CONVENTIONS.feedbackPattern;
    expect(pattern.test('001-initial-review.md')).toBe(true);
    expect(pattern.test('002-architecture-discussion.md')).toBe(true);
    expect(pattern.test('100-feedback.md')).toBe(true);
    expect(pattern.test('01-setup.md')).toBe(false);
    expect(pattern.test('1-feedback.md')).toBe(false);
  });

  it('should have evidence patterns', () => {
    const patterns = PLAN_CONVENTIONS.evidencePatterns;
    expect(patterns).toHaveLength(4);
    expect(patterns[0].test('what-happened-in-project-x.md')).toBe(true);
    expect(patterns[1].test('research-best-practices.md')).toBe(true);
    expect(patterns[2].test('analysis-architecture.md')).toBe(true);
    expect(patterns[3].test('example-usage.md')).toBe(true);
  });

  it('should have standard files including changelog', () => {
    expect(PLAN_CONVENTIONS.standardFiles.summary).toBe('SUMMARY.md');
    expect(PLAN_CONVENTIONS.standardFiles.status).toBe('STATUS.md');
    expect(PLAN_CONVENTIONS.standardFiles.executionPlan).toBe('EXECUTION_PLAN.md');
    expect(PLAN_CONVENTIONS.standardFiles.changelog).toBe('CHANGELOG.md');
  });

  it('should have standard directories including feedback, evidence, history', () => {
    expect(PLAN_CONVENTIONS.standardDirs.plan).toBe('plan');
    expect(PLAN_CONVENTIONS.standardDirs.analysis).toBe('analysis');
    expect(PLAN_CONVENTIONS.standardDirs.feedback).toBe('feedback');
    expect(PLAN_CONVENTIONS.standardDirs.evidence).toBe('evidence');
    expect(PLAN_CONVENTIONS.standardDirs.history).toBe('.history');
  });

  it('should have status emoji mapping', () => {
    expect(PLAN_CONVENTIONS.statusEmoji.pending).toBe('⬜');
    expect(PLAN_CONVENTIONS.statusEmoji.in_progress).toBe('🔄');
    expect(PLAN_CONVENTIONS.statusEmoji.completed).toBe('✅');
    expect(PLAN_CONVENTIONS.statusEmoji.failed).toBe('❌');
    expect(PLAN_CONVENTIONS.statusEmoji.blocked).toBe('⏸️');
    expect(PLAN_CONVENTIONS.statusEmoji.skipped).toBe('⏭️');
  });

  it('should have emoji to status reverse mapping', () => {
    expect(PLAN_CONVENTIONS.emojiToStatus['⬜']).toBe('pending');
    expect(PLAN_CONVENTIONS.emojiToStatus['🔄']).toBe('in_progress');
    expect(PLAN_CONVENTIONS.emojiToStatus['✅']).toBe('completed');
    expect(PLAN_CONVENTIONS.emojiToStatus['❌']).toBe('failed');
    expect(PLAN_CONVENTIONS.emojiToStatus['⏸️']).toBe('blocked');
    expect(PLAN_CONVENTIONS.emojiToStatus['⏭️']).toBe('skipped');
  });
});

