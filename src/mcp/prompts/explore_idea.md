# Explore Idea

## Purpose

Guide collaborative exploration of a new idea without premature commitment. This prompt helps capture initial thinking, constraints, and questions before moving to formal planning.

## When to Use

- User mentions a new concept or feature
- Starting to think about a problem
- Not ready to commit to a full plan yet
- Want to capture thoughts and gather evidence
- User wants to resume exploring an existing plan

## Workflow

### 1. Detect Existing Plan or Create New

**FIRST: Check if the user provided a path to an existing plan.**

Look for:
- A file path or directory path in the user's message
- Plan files: IDEA.md, SHAPING.md, STATUS.md, or LIFECYCLE.md

**If user provides a path:**
- Check if IDEA.md, SHAPING.md, STATUS.md, or LIFECYCLE.md exists at that path
- If YES → this is an EXISTING plan, go to step 1b (Resume Existing Plan)
- If NO → this is a new plan, continue to step 1a (Extract or Gather Idea Details)

**If user doesn't provide a path:**
- Continue to step 1a (Extract or Gather Idea Details) to create a new idea

### 1a. Extract or Gather Idea Details (New Plans Only)

**FIRST: Check if the user already provided details in their message.**

Look for:
- A code/identifier (kebab-case name like "my-feature")
- A description of the concept

**If both are present in the user's message:**
- Extract them immediately
- Proceed directly to creating the idea
- Do NOT ask the user to repeat information they already provided

**If either is missing:**
- Have a natural conversation: "What idea would you like to explore? Give me a short name and brief description."
- When they respond, extract the code (convert to kebab-case if needed) and description
- Then create the idea

**Example extractions:**

User says: "explore_idea user-notifications I want to add real-time notifications"
→ code: "user-notifications", description: "I want to add real-time notifications"

User says: "explore_idea real-time notifications for users"
→ code: "real-time-notifications" (derived), description: "real-time notifications for users"

User says: "explore_idea"
→ Ask: "What idea would you like to explore? Give me a short name and brief description."

### 1b. Resume Existing Plan (Existing Plans Only)

**If an existing plan is detected:**

1. **Read the current state:**
   ```
   riotplan_status({ path: "/path/to/plan" })
   riotplan_history_show({ path: "/path/to/plan", limit: 10 })
   ```

2. **Summarize what exists:**
   - "I see an existing plan: [name]"
   - "Current stage: [idea/shaping/built/executing]"
   - "The plan has [N] notes, [N] constraints, [N] questions"
   - "Last activity: [last action from history]"

3. **Ask where to pick up:**
   - "Where would you like to pick up?"
   - "Want to continue exploring, or are you ready to move to the next stage?"

4. **Continue exploration:**
   - Use the same exploration workflow as new ideas (steps 3-5)
   - Add new notes, constraints, questions, evidence as the conversation continues
   - Do NOT create a new idea - the plan already exists

**Example:**

**User**: "explore_idea /Users/me/plans/user-notifications"

**AI**: *Checks for plan files, finds IDEA.md*
*Calls riotplan_status and riotplan_history_show*

**AI**: "I see an existing plan: user-notifications. Current stage: idea. The plan has 3 notes, 2 constraints, and 4 questions. Last activity: Added constraint about mobile support. Where would you like to pick up?"

### 2. Create the Idea (New Plans Only)

Once you have both code and description, create the idea immediately:

```
riotplan_idea_create({
  code: "extracted-or-provided-code",
  description: "extracted or provided description"
})
```

### 3. Begin Exploration

After creating the idea, immediately begin the exploration conversation. Don't wait for further prompting.

Ask open-ended questions:
- "What's driving this idea?"
- "What constraints should we consider?"
- "What questions need answering?"
- "Do you have any evidence (docs, diagrams, examples)?"

### 4. Capture Responses in TWO Ways

As the user responds, capture their thinking in TWO ways:

**FIRST: Capture the full narrative (preserve the raw conversation)**

When the user provides detailed responses, especially voice transcriptions or long explanations, capture the FULL TEXT as narrative:

```
riotplan_idea_add_narrative({
  content: "[User's complete response, verbatim or paraphrased if spoken]",
  source: "voice",  // or "typing", "paste", "import"
  context: "User explaining document type requirements"
})
```

**THEN: Extract structured information**

After capturing the narrative, extract key points into structured categories:

**For thoughts/notes:**
```
riotplan_idea_add_note({
  note: "User's thought or observation"
})
```

**For constraints:**
```
riotplan_idea_add_constraint({
  constraint: "Must work on mobile"
})
```

**For questions:**
```
riotplan_idea_add_question({
  question: "How will this integrate with existing API?"
})
```

**For evidence:**
```
riotplan_idea_add_evidence({
  evidencePath: "./path/to/diagram.png",
  description: "Architecture diagram showing current state"
})
```

**Why Both?**
- Narrative preserves full context and nuance
- Structured data makes information actionable
- Timeline shows both the conversation and the decisions

### 4a. Proactive Evidence Capture

**CRITICAL**: When the user asks you to research, investigate, or look up information, you MUST capture your findings as evidence immediately. Don't wait for the user to ask "where is that thing you found?"

#### Detecting Research Requests

Watch for these trigger phrases that indicate the user wants you to gather information:
- "Go look up..."
- "Find out about..."
- "How does X work?"
- "What's the standard for..."
- "Can you check..."
- "Research..."
- "Investigate..."
- "What does the documentation say about..."

When you see these, the user is asking for research. Your findings MUST be captured as evidence.

#### Capturing Research Findings

After you investigate and find information, immediately capture it using `riotplan_idea_add_evidence` with **full metadata**:

```
riotplan_idea_add_evidence({
  description: "Clear description of what was found",
  content: "The actual findings - code snippets, documentation text, analysis, etc.",
  source: "Where it came from (e.g., 'codebase analysis', 'web search', 'documentation')",
  sourceUrl: "URL if applicable (e.g., 'https://docs.example.com/api')",
  originalQuery: "The user's original question/request",
  gatheringMethod: "model-assisted"
})
```

**All fields matter:**
- `description`: What you found (becomes the filename)
- `content`: The actual findings (inline evidence)
- `source`: General source type
- `sourceUrl`: Specific URL if applicable
- `originalQuery`: What the user asked for (chain of evidence)
- `gatheringMethod`: Always "model-assisted" when you gather it

#### Example Flow

**User**: "Can you go find the standard for voice and tone in technical writing?"

**You**: *Searches and finds information*

**You**: *Immediately captures evidence:*
```
riotplan_idea_add_evidence({
  description: "Microsoft Writing Style Guide - Voice and Tone",
  content: "Key principles from Microsoft Writing Style Guide:\n\n- Use conversational, natural language\n- Be warm and relaxed without being frivolous\n- Use contractions (it's, you're, we're)\n- Address the reader directly (you, your)\n- Avoid jargon and overly technical terms\n- Be brief and get to the point\n\nSource: https://learn.microsoft.com/en-us/style-guide/brand-voice-above-all-simple-human",
  source: "web search",
  sourceUrl: "https://learn.microsoft.com/en-us/style-guide/brand-voice-above-all-simple-human",
  originalQuery: "Can you go find the standard for voice and tone in technical writing?",
  gatheringMethod: "model-assisted"
})
```

**You**: "I found the Microsoft Writing Style Guide's recommendations on voice and tone. I've captured the key principles as evidence. The main themes are conversational language, warmth, and brevity."

#### Anti-Patterns

❌ **Don't investigate without capturing** - If the user asks you to research something, the findings MUST go into evidence/

❌ **Don't wait for the user to ask** - Capture evidence immediately after finding information, not after the user says "where is that thing you found?"

❌ **Don't skip metadata** - Always include `sourceUrl` and `originalQuery` when capturing evidence. This makes evidence useful beyond the plan lifetime.

❌ **Don't use vague descriptions** - The description becomes the filename. Use clear, specific descriptions like "API authentication flow analysis" not "findings"

✅ **Do capture proactively** - Research request → Investigate → Capture evidence → Tell user what you found

✅ **Do include full metadata** - Every field (description, content, source, sourceUrl, originalQuery, gatheringMethod) has value

✅ **Do use descriptive names** - Evidence files should be browsable. "research-voice-tone-standards.md" is better than "evidence-1234567890.md"

### 5. Decide Next Steps

After exploration, ask:
- "Does this feel worth pursuing?"
- "Are we ready to explore different approaches?" (→ shaping)
- "Should we set this aside for now?" (→ kill)

**If ready to shape:**
```
riotplan_shaping_start()
```

**If not viable:**
```
riotplan_idea_kill({
  reason: "Not feasible due to X"
})
```

**If needs more time:**
Just leave it in idea stage. Can return later.

## Key Principles

1. **No Commitment**: Ideas don't obligate execution
2. **Cheap Thinking**: Capture thoughts without formality
3. **Evidence Gathering**: Collect supporting materials
4. **Question-Driven**: Surface unknowns early
5. **Smart Extraction**: Use information the user already provided; don't make them repeat themselves

## Example Conversations

### Example 1: User Provides Everything Upfront

**User**: `/riotplan/explore_idea real-time-notifications Add push notifications for important updates`

**AI**: *Extracts code="real-time-notifications", description="Add push notifications for important updates"*
*Calls riotplan_idea_create immediately*

**AI**: "Let's explore this idea. What's driving the need for push notifications? What constraints should we consider?"

### Example 2: User Provides Partial Info

**User**: `/riotplan/explore_idea I want to add notifications`

**AI**: *Extracts description="I want to add notifications", derives code="add-notifications"*
*Calls riotplan_idea_create immediately*

**AI**: "Let's explore this notification idea. What's driving this? What problem does it solve?"

### Example 3: User Provides No Info

**User**: `/riotplan/explore_idea`

**AI**: "What idea would you like to explore? Give me a short name and brief description."

**User**: "I'm thinking about real-time notifications for users"

**AI**: *Extracts code="real-time-notifications", description="real-time notifications for users"*
*Calls riotplan_idea_create*

**AI**: "Great! Let's explore this. What's driving the need for real-time notifications?"

### Example 4: Rich Exploration with Narrative

**User**: "Users miss important updates. They have to refresh constantly. It's frustrating for them and we're getting complaints. I think we need some kind of push notification system but I'm not sure if it should be in-app only or also email."

**AI**: *Captures full narrative first:*
```
riotplan_idea_add_narrative({
  content: "Users miss important updates. They have to refresh constantly. It's frustrating for them and we're getting complaints. I think we need some kind of push notification system but I'm not sure if it should be in-app only or also email.",
  source: "typing",
  context: "User explaining the problem driving this idea"
})
```

*Then adds structured note:*
```
riotplan_idea_add_note({
  note: "Problem: Users missing updates, forced to refresh manually. Considering push notifications (in-app vs email unclear)"
})
```

**AI**: "Good context. What constraints should we consider?"

**User**: "Must work on mobile. Can't require WebSockets everywhere. Also need to keep costs reasonable."

**AI**: *Captures narrative and extracts constraints*

### Example 5: Resuming an Existing Plan

**User**: "explore_idea /Users/me/plans/riotplan-losing-focus"

**AI**: *Checks path, finds IDEA.md, SHAPING.md, LIFECYCLE.md*
*Calls riotplan_status and riotplan_history_show*

**AI**: "I see an existing plan: riotplan-losing-focus. Current stage: shaping. The plan has 8 notes, 4 constraints, and 6 questions. Two approaches have been added: 'Embedded Behavioral Layer' and 'Session-Based State Machine'. The 'Embedded Behavioral Layer' approach was selected. Where would you like to pick up?"

**User**: "I want to add more notes about the heartbeat design"

**AI**: "Great, let's capture those thoughts."
*Uses riotplan_idea_add_note to add new notes as the user discusses*

## Anti-Patterns

❌ Don't ask for information the user already provided
❌ Don't immediately jump to solutions
❌ Don't create detailed plans yet
❌ Don't pressure for commitment
❌ Don't skip evidence gathering
❌ Don't investigate without capturing evidence
❌ Don't wait for user to ask "where is that thing you found?"
❌ Don't skip metadata when capturing evidence (sourceUrl, originalQuery matter)
❌ Don't stop after creating the idea—begin exploration immediately
❌ Don't create a new idea when an existing plan is detected at the provided path

✅ Do extract information from the user's message
✅ Do ask open questions
✅ Do capture all thinking
✅ Do surface constraints early
✅ Do gather supporting materials proactively
✅ Do capture research findings immediately with full metadata
✅ Do use descriptive evidence filenames
✅ Do start the conversation immediately after creating the idea
✅ Do detect existing plans when a path is provided
✅ Do summarize existing plan state before continuing exploration

## Transition Criteria

**To Shaping**: User wants to explore implementation approaches
**To Kill**: Idea not viable or not worth pursuing
**Stay in Idea**: Need more time to think, not ready yet
