# Shape Approach

## Purpose

Collaboratively explore and compare different approaches to solving a problem before committing to detailed planning. This is where tradeoffs are surfaced and decisions are made.

## When to Use

- Transitioning from idea to concrete planning
- Multiple valid approaches exist
- Significant tradeoffs to consider
- Need to align on direction before building

## Workflow

### 1. Start Shaping

Transition from idea:
```
riotplan_shaping_start()
```

### 2. Identify Approaches

Ask the user:
- "What approaches could we take?"
- "What have you seen work elsewhere?"
- "What are the obvious options?"

For each approach, capture:
- Name (clear, descriptive)
- Description (what it is, how it works)
- Tradeoffs (pros and cons)
- Assumptions (what must be true)

```
riotplan_shaping_add_approach({
  name: "REST API with Polling",
  description: "Traditional REST endpoints with client-side polling every 30s",
  tradeoffs: [
    "Pro: Simple, well understood by team",
    "Pro: Works with existing infrastructure",
    "Con: Higher latency (up to 30s)",
    "Con: More server load from constant polling"
  ],
  assumptions: [
    "30s latency is acceptable",
    "Server can handle polling load"
  ]
})
```

### 3. Gather Feedback

As you discuss approaches, capture the user's thinking:

```
riotplan_shaping_add_feedback({
  feedback: "Concerned about polling load. We have 10k active users. That's 333 requests/second just for notifications."
})
```

### 4. Add Evidence

Encourage evidence-based decision making:
- Performance benchmarks
- Architecture diagrams
- Code examples
- Similar systems
- Research papers

```
riotplan_shaping_add_evidence({
  evidencePath: "./benchmarks/polling-vs-websocket.md",
  description: "Performance comparison from similar scale system",
  relatedTo: "REST API with Polling"
})
```

### 5. Compare Approaches

When ready to decide:
```
riotplan_shaping_compare()
```

This shows all approaches side-by-side with their tradeoffs.

### 6. Select Approach

Once aligned:
```
riotplan_shaping_select({
  approach: "Server-Sent Events (SSE)",
  reason: "Balances real-time updates with infrastructure simplicity. Team has SSE experience. Lower server load than polling."
})
```

### 7. Build Plan

After selection, build the detailed plan:
```
riotplan_build({
  description: "Optional: Override description from IDEA.md",
  steps: 5  // Optional: Specify number of steps
})
```

This will:
- Use AI to generate detailed plan from IDEA.md and SHAPING.md content
- Create SUMMARY.md, EXECUTION_PLAN.md, STATUS.md
- Create plan/ directory with step files
- Transition to "built" stage automatically
- Preserve all existing idea and shaping content

Alternatively, if you just want to transition stages without generating plan files:
```
riotplan_transition({
  stage: "built",
  reason: "Approach selected and validated"
})
```

## Key Principles

1. **Multiple Options**: Always consider alternatives
2. **Explicit Tradeoffs**: Surface pros and cons
3. **Evidence-Based**: Use data, not opinions
4. **Collaborative**: User drives decisions
5. **No Premature Detail**: Stay high-level

## Example Conversation

**User**: "Let's explore approaches for real-time notifications"

**AI**: "I'll start the shaping process. What approaches should we consider?"

**User**: "Polling, WebSockets, or Server-Sent Events"

**AI**: "Good options. Let's capture each with tradeoffs."

*Adds three approaches with tradeoffs*

**AI**: "Looking at these, what's your initial reaction?"

**User**: "Polling feels wasteful. WebSockets might be overkill. SSE is interesting but I'm not sure about browser support."

*Adds feedback*

**AI**: "Do you have any evidence about SSE browser support?"

**User**: "Let me check... here's caniuse data" [attaches link]

*Adds evidence*

**AI**: "SSE has 97% browser support. Given your concerns about polling waste and WebSocket complexity, SSE seems like a middle ground. Want to compare them side-by-side?"

**User**: "Yes"

*Shows comparison*

**AI**: "Which approach feels right?"

**User**: "SSE. It's simpler than WebSockets and more efficient than polling."

*Selects approach*

**AI**: "Great. Ready to build a detailed plan based on SSE?"

**User**: "Yes"

*Transitions to built, generates plan*

## Anti-Patterns

❌ Don't present only one approach
❌ Don't hide tradeoffs
❌ Don't make decisions for the user
❌ Don't skip evidence gathering
❌ Don't rush to detailed planning

✅ Do explore multiple options
✅ Do surface all tradeoffs
✅ Do let user drive selection
✅ Do gather supporting evidence
✅ Do take time to align

## Transition Criteria

**To Built**: Approach selected, ready for detailed planning
**Back to Idea**: Need to rethink the core concept
**Stay in Shaping**: More approaches to explore, more evidence needed

## Tips

- Aim for 2-4 approaches (not too few, not overwhelming)
- Be honest about tradeoffs (every approach has downsides)
- Use evidence to resolve debates
- Document why alternatives were rejected
- Capture assumptions explicitly
