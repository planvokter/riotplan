# Generate Plan Retrospective

## Purpose

Generate a high-value retrospective for a completed plan that captures genuine learning and provides actionable insights for future planning. This is NOT a summary or status report - it's a critical analysis of what happened during execution and what should be done differently next time.

## Context You Will Receive

You will be provided with the complete execution record:

1. **Original Plan**:
   - SUMMARY.md - The vision and approach
   - EXECUTION_PLAN.md - The planned sequence
   - Step files - Detailed tasks and acceptance criteria

2. **Actual Execution**:
   - STATUS.md - What actually happened
   - Step reflections - Real-time observations from execution
   - Completion dates and durations

3. **The Gap**:
   - Compare what was planned vs. what happened
   - Identify where assumptions failed
   - Understand where adaptation occurred

## Your Task

Write a retrospective that answers three core questions with brutal honesty and creative insight:

### 1. What Went Right?

Identify patterns, decisions, or approaches that worked well and should be repeated.

**Good examples:**
- "Breaking the authentication step into interface design + implementation was correct. The interface-first approach prevented coupling issues that would have required refactoring."
- "Estimating 60 minutes for prompt design (Step 4) was accurate. Prompts ARE the product in LLM systems, and treating them as first-class deliverables paid off."

**Bad examples:**
- "The plan was well-structured" (too vague)
- "All steps completed successfully" (that's status, not insight)

### 2. What Went Wrong?

Where did assumptions fail? Where was the plan over-specified or under-specified? What caused friction?

**Good examples:**
- "Step 2 assumed STATUS.md generation was synchronous, but making it async to check for reflection files cascaded through 46 test files. The plan should have included 'audit all callers' as a subtask."
- "The plan didn't account for the reflection system being meta - we're building the tool while simultaneously being the first users. This created a chicken-and-egg problem that required working without reflections for steps 1-3."

**Bad examples:**
- "Some steps took longer than expected" (which ones? why? what does that teach us?)
- "There were a few challenges" (be specific or don't mention it)

### 3. What Would You Do Differently?

If creating this plan again from scratch, what concrete changes would produce better outcomes?

**Good examples:**
- "Add a Step 0: 'Create test plan with reflection fixtures'. Testing reflection-dependent code without fixtures was awkward. Future plans should set up test infrastructure before implementation."
- "The step sequence should have been: (1) data model, (2) writer, (3) reader + tests, (4) MCP tool, (5) STATUS.md integration. We did 1-2-3-4 then went back to update STATUS.md, which felt out of order."

**Bad examples:**
- "Better planning would help" (how? be concrete)
- "More time for testing" (what specific testing gap did you encounter?)

## Critical Instructions

### DO:
- **Be specific**: Name exact files, functions, steps, and decisions
- **Be surprising**: What insight would someone not expect?
- **Be actionable**: Every observation should suggest a concrete change
- **Compare plan vs reality**: "We thought X, but actually Y happened because Z"
- **Identify the single most surprising thing**: What caught you most off-guard?
- **Identify the assumption that was most wrong**: What belief turned out to be false?
- **Propose a structural change**: What should the plan template itself include?

### DO NOT:
- **Summarize what happened**: That's what SUMMARY.md and STATUS.md are for
- **List step accomplishments**: "Step 1 did X, Step 2 did Y..." is not reflection
- **Use generic praise**: "Overall successful", "went smoothly", "well-executed" are filler
- **Avoid criticism**: If something went wrong, say so and explain what to do differently
- **Write a template**: Every retrospective should be unique to its plan's actual experience

## Output Format

Write freeform prose that reads like a thoughtful colleague's post-mortem. No fixed sections, but naturally cover:

1. **Plan vs Reality**: What did we expect vs what actually happened?
2. **Assumption Audit**: Which beliefs turned out wrong?
3. **Specification Quality**: Where was the plan too detailed or not detailed enough?
4. **Adaptation Patterns**: How did execution diverge from the plan, and why?
5. **Recommendations**: What should future plans do differently?

The retrospective should be something you'd want to read six months from now when creating a similar plan.

## Quality Bar

Ask yourself:
- Would future-me learn something concrete from this?
- Does this surface a pattern I wouldn't have noticed without reflection?
- Could I use this to make a specific improvement to the next plan?

If the answer to any of these is "no", dig deeper.

## Model Tier Recommendation

This task requires genuine creative reasoning and pattern recognition. Use the highest-tier model available (Opus-class or equivalent). Retrospectives generated with lower-tier models tend toward generic observations and miss the surprising insights that make retrospectives valuable.

## Anti-Pattern Examples

**Bad Retrospective:**
```
The plan was executed successfully over 8 steps. All acceptance criteria were met. 
Step 1 created the reflection infrastructure. Step 2 updated STATUS.md. Step 3 updated prompts.
The team worked well together and the implementation was solid. Overall, a successful project.
```

**Why it's bad:** It's a summary, not reflection. No insights, no learning, no actionable changes.

**Good Retrospective:**
```
The most surprising thing: Making generateStatus() async cascaded through 46 test files. 
We assumed it was a localized change (just add 'await'), but the test suite used it 
synchronously everywhere. This revealed a gap in the plan: Step 2 should have included 
"Audit and update all callers" as an explicit subtask.

The assumption that was most wrong: That we could test the reflection system while building it. 
Steps 1-3 had no reflections to learn from, which meant we couldn't dogfood the feature until 
Step 4. Future plans should include a "bootstrap" phase where test fixtures or sample data 
enable testing before the system is self-hosting.

Structural recommendation: Add a "Testing Strategy" section to step files. It's not enough 
to say "add tests" - specify what fixtures are needed, what edge cases to cover, and whether 
test-first or implementation-first makes more sense for this particular step.
```

**Why it's good:** Specific, surprising, actionable. Identifies concrete changes to both this plan's approach and the plan template itself.

## Remember

You are not writing a report for a manager. You are writing notes for your future self. 
Be honest. Be specific. Be useful.

The goal is continuous improvement: each plan should be better than the last because we learned from the retrospective of the previous one.
