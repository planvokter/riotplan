# RiotPlan User Stories

This guide shows how different users approach RiotPlan based on their needs and working styles.

## The Spectrum of Use

RiotPlan adapts to your workflow, from quick execution to deep exploration:

```
Fast ←────────────────────────────────────────────→ Thorough
5 min           15 min           1-2 hrs           Multiple days
Story 1         Story 2          Story 3           Story 4
```

## Story 1: The Speed Runner (5 minutes)

**Profile**: You know exactly what you want. You've done this before. You just need a structured plan and guidance.

### Workflow

1. **Describe what you want** in one sentence
2. **AI generates plan** with appropriate steps
3. **Execute with AI guidance** - conversational pair programming
4. **Done** - plan complete

### Tools Used

- `riotplan_create` - Generate plan from description
- `execute_plan` prompt - Guided execution with state management

### Example: Adding Authentication

```typescript
// You: "I need to add JWT authentication to my app"

riotplan_create({
  code: "auth-system",
  description: "Add JWT authentication with user login, token refresh, and logout",
  directory: "./plans"
})

// AI generates 8 steps:
// 1. Install JWT dependencies
// 2. Create user model and database schema
// 3. Implement registration endpoint
// 4. Implement login endpoint with JWT generation
// 5. Create token refresh endpoint
// 6. Implement logout functionality
// 7. Add authentication middleware
// 8. Test authentication flow

// You: "Execute the plan"
// AI: "Let's start with Step 1: Install JWT dependencies..."
// [AI guides you through each step conversationally]
```

### What You Get

- **Fast**: From idea to execution in minutes
- **Guided**: AI walks you through each step
- **No overhead**: Minimal ceremony, maximum productivity
- **State management**: Can pause and resume anytime

### When to Use This

- You've built similar things before
- Requirements are clear
- You want to move fast
- You trust the AI to generate a good plan

---

## Story 2: The Refiner (15 minutes)

**Profile**: You have a clear idea, but the generated plan needs adjustments before execution.

### Workflow

1. **Generate initial plan** from description
2. **Review and provide feedback** on the plan
3. **AI refines plan** based on your feedback
4. **Iterate** until satisfied
5. **Execute** the refined plan

### Tools Used

- `riotplan_create` - Generate initial plan
- `develop_plan` prompt - Refine through conversational feedback
- `execute_plan` prompt - Execute refined plan

### Example: Microservices Architecture

```typescript
// You: "I need to split my monolith into microservices"

riotplan_create({
  code: "microservices-split",
  description: "Split monolithic application into microservices architecture with API gateway",
  directory: "./plans"
})

// AI generates plan with 12 steps

// You: "This looks good overall, but I think we need more steps for the testing phase. 
// Also, step 3 mentions 'identify service boundaries' but doesn't explain how."

// AI captures feedback as narrative:
riotplan_idea_add_narrative({
  content: "User wants more detail on testing and service boundary identification...",
  speaker: "assistant"
})

// AI: "I'll break down the testing phase into 3 separate steps and expand step 3 
// with specific techniques for identifying service boundaries (Domain-Driven Design, 
// business capability mapping, etc.)"

// [AI updates plan]

// You: "Perfect! Now let's execute it"

// [Execution begins]
```

### What You Get

- **Control**: Shape the plan before committing
- **Feedback capture**: All refinements documented in timeline
- **Iterative**: Multiple rounds of feedback supported
- **Confidence**: Execute knowing the plan matches your vision

### When to Use This

- Generated plan is close but needs tweaks
- You have specific preferences or constraints
- You want to validate the approach before executing
- You need to add domain-specific knowledge

---

## Story 3: The Explorer (1-2 hours)

**Profile**: You're exploring an idea. You need to think it through, gather evidence, and consider alternatives before committing.

### Workflow

1. **Create an idea** (not a plan yet)
2. **Explore conversationally** - capture thoughts, questions, constraints
3. **Gather evidence** - paste transcripts, reference files, search the web
4. **Create checkpoints** at key moments
5. **Shape approaches** - explore alternatives with tradeoffs
6. **Select approach** and generate plan
7. **Execute** the plan

### Tools Used

- `riotplan_idea_create` - Start exploring
- `explore_idea` prompt - Guided ideation
- `riotplan_idea_add_narrative` - Capture raw thinking
- `riotplan_idea_add_evidence` - Attach supporting materials
- `riotplan_checkpoint_create` - Save state at key moments
- `shape_approach` prompt - Compare alternatives
- `riotplan_create` - Generate plan from shaped idea
- `execute_plan` prompt - Execute

### Example: Real-Time Notifications

```typescript
// Day 1, Hour 1: Initial Exploration

// You: "I'm thinking about adding some kind of notification system..."

riotplan_idea_create({
  code: "notifications",
  description: "Exploring real-time notification system for user updates"
})

// AI: "Let's explore this together. What kind of notifications are you thinking about?"

// You: "Well, users need to know when things happen - new messages, status updates, 
// that kind of thing. I'm not sure if we need real-time or if polling is fine."

// AI captures narrative:
riotplan_idea_add_narrative({
  content: "User is considering notification system for messages and status updates. 
  Uncertain about real-time vs polling approach. This suggests we need to explore 
  technical tradeoffs and user experience requirements.",
  speaker: "assistant",
  context: "Initial exploration"
})

// AI: "Good question. Let me search for information about notification approaches..."
// [AI uses web search capability]

riotplan_idea_add_evidence({
  evidencePath: "inline",
  content: "[Web research findings on WebSocket vs SSE vs polling...]",
  description: "Research on real-time notification approaches: WebSocket, SSE, long polling",
  source: "web search",
  gatheringMethod: "model-assisted"
})

// You: "Interesting. Let me paste some notes from our team meeting..."
// [Paste transcript]

riotplan_idea_add_evidence({
  evidencePath: "inline",
  content: "[Meeting transcript about notification requirements...]",
  description: "Team meeting notes discussing notification requirements and user expectations",
  source: "user paste"
})

// AI: "Based on the meeting notes, it sounds like real-time is important for messages 
// but status updates could be polling. Let me add that as a constraint..."

riotplan_idea_add_constraint({
  constraint: "Messages need real-time delivery (< 1 second), status updates can tolerate 30-second delays"
})

// Hour 2: Shaping Approaches

// AI: "We've gathered good context. Ready to explore different approaches?"

// You: "Yes, let's look at options"

// [Switch to shaping]

riotplan_shaping_start({ path: "./notifications" })

// AI helps you define approaches:
// - Approach A: WebSocket for everything
// - Approach B: WebSocket for messages, polling for status
// - Approach C: Server-Sent Events (SSE) hybrid

// You provide feedback on each approach

// AI: "Let me create a checkpoint before we select an approach..."

riotplan_checkpoint_create({
  name: "approaches-defined",
  message: "Defined three notification approaches with tradeoffs. Ready to select."
})

// You: "I think Approach B makes the most sense - WebSocket for messages, polling for status"

riotplan_shaping_select({
  approach: "Approach B: WebSocket + Polling Hybrid",
  reason: "Balances real-time requirements for messages with simpler polling for status updates"
})

// AI: "Great! Ready to generate the plan?"

// You: "Yes"

// [Plan generation and execution]
```

### What You Get

- **Rich exploration**: Capture all your thinking
- **Evidence-based**: Ground decisions in research and data
- **Checkpoints**: Save state at key decision points
- **Approach comparison**: Explicit tradeoff analysis
- **Complete history**: Timeline shows how idea evolved
- **Resumable**: Can pause and continue over days

### When to Use This

- You're not sure what you want yet
- The problem is complex or unfamiliar
- You need to gather information
- Multiple approaches are possible
- You want to document your thinking
- You're working on this over multiple sessions

---

## Story 4: The Long-Haul Developer (Multiple days)

**Profile**: You're tackling a complex, long-term problem. You need time to think, explore dead ends, and preserve your thinking across days or weeks.

### Workflow

**Day 1**: Explore idea, capture thinking, create checkpoint

**Day 3**: Continue exploration, try new direction

**Day 5**: Hit dead end, restore checkpoint, try different approach

**Day 7**: Select approach, generate plan

**Day 10**: Start executing plan

**Day 12**: Complete first phase, create checkpoint

**Day 15**: Resume execution, complete plan

### Tools Used

All tools from Story 3, plus:
- `riotplan_checkpoint_restore` - Recover from dead ends
- `riotplan_history_show` - Review timeline of exploration
- Multiple checkpoints throughout the journey

### Example: Legacy System Refactoring

```typescript
// Week 1: Exploration and Analysis

// Day 1: Initial exploration
riotplan_idea_create({
  code: "legacy-refactor",
  description: "Refactor legacy PHP application to modern architecture"
})

// Capture initial thoughts, add evidence from codebase analysis
// Create checkpoint: "initial-analysis"

// Day 3: Explore microservices approach
// Add evidence, capture narrative about challenges
// Create checkpoint: "microservices-exploration"

// Day 5: Realize microservices is too complex for this case
riotplan_checkpoint_restore({ checkpoint: "initial-analysis" })

// Try modular monolith approach instead
// Create checkpoint: "modular-monolith-exploration"

// Week 2: Shaping and Planning

// Day 8: Shape approaches (modular monolith vs strangler fig)
// Compare tradeoffs, select modular monolith
// Create checkpoint: "approach-selected"

// Day 10: Generate plan
riotplan_create({
  code: "legacy-refactor",
  description: "Refactor to modular monolith architecture",
  directory: "./plans"
})

// Review plan, provide feedback, refine
// Create checkpoint: "plan-ready"

// Week 3-4: Execution

// Day 15: Start execution
// Complete steps 1-3
// Create checkpoint: "phase-1-complete"

// Day 20: Continue execution
// Hit blocker in step 6
// Document blocker, discuss solutions
// Create checkpoint: "before-database-migration"

// Day 22: Resume after resolving blocker
// Complete remaining steps
// Plan complete!
```

### What You Get

- **Long-term state preservation**: Pick up exactly where you left off
- **Exploration freedom**: Try different directions without fear
- **Recovery from dead ends**: Restore to earlier checkpoints
- **Complete audit trail**: Timeline shows entire journey
- **Evidence accumulation**: Build knowledge base over time
- **Flexible pacing**: Work when you have time and energy

### When to Use This

- Complex, unfamiliar problems
- Architectural decisions with long-term impact
- Working part-time on a project
- Need to explore multiple directions
- Want complete documentation of decision-making
- Collaborating asynchronously

---

## Choosing Your Story

### Start Here

**If you're new to RiotPlan**: Start with Story 1 or 2. Get comfortable with basic plan generation and execution.

**If you're tackling something complex**: Jump to Story 3. The exploration tools will help you think it through.

**If you're working long-term**: Use Story 4. Checkpoints and timeline will preserve your thinking.

### Mixing Stories

**Most users don't stick to one story**. You might:

- Start with Story 1 for quick tasks
- Use Story 2 when generated plans need tweaking
- Graduate to Story 3 for complex problems
- Use Story 4 for major architectural work

The tool adapts to your needs, not the other way around.

### Key Insight

**The difference isn't in the features - it's in how much you use them:**

- Story 1: Minimal features (just plan generation and execution)
- Story 2: Add feedback and refinement
- Story 3: Add exploration, evidence, checkpoints
- Story 4: Use everything, over extended time

All features are always available. Use what you need, when you need it.

---

## Common Patterns

### The "Quick Start, Deep Dive" Pattern

1. Generate plan quickly (Story 1)
2. Start execution
3. Realize it's more complex than expected
4. Create checkpoint
5. Switch to exploration mode (Story 3)
6. Gather evidence, shape approaches
7. Refine plan (Story 2)
8. Resume execution

### The "Explore First, Execute Fast" Pattern

1. Explore idea thoroughly (Story 3)
2. Shape approaches, select one
3. Generate plan
4. Execute quickly (Story 1) - no refinement needed because exploration was thorough

### The "Iterative Refinement" Pattern

1. Generate plan (Story 1)
2. Execute first few steps
3. Realize plan needs adjustment
4. Create checkpoint
5. Refine plan (Story 2)
6. Resume execution
7. Repeat as needed

---

## Tips for Each Story

### Story 1 Tips

- **Be specific** in your description - helps AI generate better plan
- **Trust the process** - AI has seen similar problems before
- **Use checkpoints** if you want to pause
- **Don't overthink** - you can always refine later

### Story 2 Tips

- **Provide clear feedback** - explain why something needs to change
- **Iterate freely** - multiple rounds of feedback are fine
- **Create checkpoint** before major changes
- **Show examples** if AI doesn't understand your feedback

### Story 3 Tips

- **Capture everything** - notes, thoughts, questions, evidence
- **Create checkpoints liberally** - they're lightweight
- **Let AI help gather evidence** - use its web search and analysis capabilities
- **Don't rush** - exploration takes time
- **Try multiple approaches** - use checkpoints to explore safely

### Story 4 Tips

- **Create checkpoints at natural stopping points** - end of day, end of phase
- **Use descriptive checkpoint names** - "before-database-migration" not "checkpoint-3"
- **Review timeline** when resuming - see what you were thinking
- **Don't fear dead ends** - checkpoints let you backtrack
- **Document decisions** - future you will thank you

---

## The Philosophy

RiotPlan is built on a simple principle: **The tool should adapt to you, not the other way around.**

- **Need speed?** Use minimal features (Story 1)
- **Need depth?** Use all features (Story 4)
- **Need something in between?** Use what makes sense (Stories 2-3)

There's no "right way" to use RiotPlan. There's only **your way**.

---

## What's Next?

Ready to start? Check out:

- [Getting Started Guide](./getting-started.md) - Installation and first steps
- [MCP Prompts Guide](./prompts.md) - Understanding the workflow prompts
- [Checkpoints Guide](./checkpoints.md) - Using checkpoints effectively
- [Evidence Guide](./evidence.md) - Gathering and organizing evidence
