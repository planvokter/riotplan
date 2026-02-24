# Evidence Gathering in RiotPlan

## Philosophy

RiotPlan provides tools for **capturing and organizing** evidence, not **gathering** it. This is a crucial architectural principle that creates a symbiotic relationship between RiotPlan and the AI models using it.

### The Symbiotic Relationship

**The Model's Role:**
- Search the web for information
- Read and analyze files
- Process pasted transcripts and notes
- Determine relevance and synthesize findings
- Make intelligent decisions about what matters

**RiotPlan's Role:**
- Provide structured tools to capture evidence
- Organize evidence chronologically in the timeline
- Store inline content (transcripts, web findings)
- Reference external files
- Track evidence sources and gathering methods

This separation allows:
- Models to use their full capabilities without RiotPlan reimplementing them
- RiotPlan to stay focused and simple
- The system to work across different AI platforms (Cursor, Claude Desktop, ChatGPT)
- Evidence gathering to leverage the latest model capabilities automatically

## Evidence Types

### 1. Inline Evidence

Inline evidence is content that gets stored directly in the plan's `.history/evidence/` directory. Use this for:

- **Pasted transcripts**: Voice notes, meeting transcripts, brainstorming sessions
- **Web research findings**: Synthesized information from web searches
- **User-provided text**: Notes, observations, copied content
- **Model analysis**: Your own analysis and synthesis of information

**Example:**
```typescript
riotplan_idea({
  action: "add_evidence",
  evidencePath: "inline",
  content: "After researching authentication approaches, I found that JWT with refresh tokens is the most common pattern. Key considerations: token expiration (15min for access, 7 days for refresh), secure storage (httpOnly cookies), and rotation strategy...",
  description: "Web research on JWT authentication patterns",
  source: "web search",
  gatheringMethod: "model-assisted"
})
```

### 2. File Evidence

File evidence is a reference to an existing file in the filesystem. Use this for:

- **Existing documents**: PDFs, Word docs, presentations
- **Code files**: Example implementations, related code
- **Data files**: CSVs, JSON, configuration files
- **Images and diagrams**: Architecture diagrams, mockups, screenshots

**Example:**
```typescript
riotplan_idea({
  action: "add_evidence",
  evidencePath: "/Users/me/projects/auth-service/src/jwt.ts",
  description: "Existing JWT implementation showing token generation and validation",
  source: "file analysis",
  gatheringMethod: "model-assisted"
})
```

## Model-Driven Gathering Workflows

### Workflow 1: Web Search

**User Request:**
> "Search the web for information about microservices architecture patterns"

**Model Actions:**
1. Use web search capability to find relevant articles, documentation, examples
2. Read and analyze the search results
3. Synthesize key findings into a coherent summary
4. Attach as inline evidence:

```typescript
riotplan_idea({
  action: "add_evidence",
  evidencePath: "inline",
  content: "[Synthesized findings from web search]",
  description: "Research on microservices architecture patterns: API Gateway, Service Discovery, Circuit Breaker, Event Sourcing",
  source: "web search",
  gatheringMethod: "model-assisted",
  relevanceScore: 0.92,
  summary: "Key patterns identified: API Gateway for routing, Service Discovery for dynamic addressing, Circuit Breaker for fault tolerance, Event Sourcing for state management"
})
```

### Workflow 2: File Analysis

**User Request:**
> "Look at the authentication code in src/auth/ and tell me how it works"

**Model Actions:**
1. Read files in src/auth/ directory using file access capabilities
2. Analyze the implementation
3. Understand the authentication flow
4. Attach relevant files as evidence:

```typescript
riotplan_idea({
  action: "add_evidence",
  evidencePath: "/Users/me/project/src/auth/jwt.ts",
  description: "JWT authentication implementation using jsonwebtoken library. Generates access tokens with 15min expiration and refresh tokens with 7 day expiration. Includes token validation middleware.",
  source: "file analysis",
  gatheringMethod: "model-assisted",
  relevanceScore: 0.95
})
```

### Workflow 3: Pasted Content

**User Action:**
> *Pastes long transcript from voice note*

**Model Actions:**
1. Receive and read the pasted content
2. Analyze for relevant insights
3. Identify key points and themes
4. Attach as inline evidence:

```typescript
riotplan_idea({
  action: "add_evidence",
  evidencePath: "inline",
  content: "[Full transcript text]",
  description: "Voice transcript discussing pain points with current planning workflow: too much time in meetings, unclear action items, difficulty tracking decisions over time",
  source: "user paste",
  gatheringMethod: "manual",
  summary: "Key themes: meeting overhead, action item tracking, decision history"
})
```

### Workflow 4: Directory Exploration

**User Request:**
> "Explore the codebase and find examples of how we handle errors"

**Model Actions:**
1. Search codebase using file access and search capabilities
2. Identify relevant files with error handling patterns
3. Analyze the patterns used
4. Attach multiple files as evidence:

```typescript
// First example
riotplan_idea({
  action: "add_evidence",
  evidencePath: "/Users/me/project/src/errors/AppError.ts",
  description: "Custom error class hierarchy with specific error types (ValidationError, AuthError, NotFoundError)",
  source: "codebase exploration",
  gatheringMethod: "model-assisted",
  relevanceScore: 0.88
})

// Second example
riotplan_idea({
  action: "add_evidence",
  evidencePath: "/Users/me/project/src/middleware/errorHandler.ts",
  description: "Express error handling middleware that catches errors, logs them, and returns appropriate HTTP responses",
  source: "codebase exploration",
  gatheringMethod: "model-assisted",
  relevanceScore: 0.91
})
```

## Evidence Metadata

When adding evidence, you can provide rich metadata:

- **description** (required): What this evidence shows and why it's relevant
- **source**: Where the evidence came from (web search, file analysis, user paste, etc.)
- **gatheringMethod**: "manual" (user provided) or "model-assisted" (you gathered it)
- **relevanceScore**: 0-1 score indicating how relevant this evidence is
- **summary**: Brief summary of key findings (especially useful for long content)

This metadata helps users understand:
- Where evidence came from
- How it was gathered
- Why it matters
- What the key points are

### Structured Reference Sources

Structured evidence records support `referenceSources` for machine-readable links:

```json
{
  "referenceSources": [
    {
      "id": "ref_auth_file",
      "type": "filepath",
      "value": "/Users/me/gitw/another-project/src/auth/refresh.ts",
      "label": "Token refresh implementation"
    },
    {
      "id": "ref_pr_discussion",
      "type": "url",
      "value": "https://github.com/org/repo/pull/1234",
      "label": "Design discussion"
    }
  ]
}
```

Reference source types:
- `filepath`: absolute or workspace-relative file/directory paths
- `url`: generic URL references (HTTP/HTTPS; intentionally provider-agnostic)
- `other`: freeform non-empty references

Backward compatibility rules:
- Existing `sources` string arrays still work.
- If `referenceSources` is missing, RiotPlan derives it from `sources` (URL => `url`, path-like => `filepath`, fallback => `other`).
- On write, RiotPlan persists `referenceSources` and mirrors `sources` as plain values for compatibility.

## Storage Structure

Evidence is stored at the top level of the plan directory for easy browsing:

```
plan-directory/
├── .history/
│   ├── timeline.jsonl           # All evidence logged here
│   └── ...
├── evidence/
│   ├── evidence-1706543210123.md  # Inline evidence
│   ├── evidence-1706543215456.md  # More inline evidence
│   └── ...
├── IDEA.md                      # Evidence linked in Evidence section
└── ...
```

### Timeline Events

Each evidence addition creates a timeline event:

```json
{
  "timestamp": "2026-01-29T16:30:22.456Z",
  "type": "evidence_added",
  "data": {
    "evidencePath": "evidence/evidence-1706543210123.md",
    "description": "Web research on JWT authentication patterns",
    "source": "web search",
    "gatheringMethod": "model-assisted",
    "relevanceScore": 0.92,
    "summary": "Key patterns identified...",
    "evidenceId": "evidence-1706543210123"
  }
}
```

### IDEA.md Links

Evidence is also linked in the IDEA.md file:

```markdown
## Evidence

- [Web research on JWT authentication patterns](evidence/evidence-1706543210123.md) (web search)
- [Existing JWT implementation](../auth-service/src/jwt.ts) (file analysis)
- [Voice transcript discussing planning workflow](evidence/evidence-1706543215456.md) (user paste)
```

## Best Practices

### For Models

1. **Use your capabilities**: Don't ask the user to search - do it yourself
2. **Analyze and synthesize**: Don't just copy-paste - add value through analysis
3. **Assess relevance**: Use relevanceScore to indicate how important evidence is
4. **Provide summaries**: Help users quickly understand what evidence shows
5. **Track sources**: Always indicate where evidence came from
6. **Be proactive**: When you see an opportunity to gather evidence, do it

### For Users

1. **Trust the model**: Let the model use its capabilities to gather evidence
2. **Provide context**: Tell the model what you're trying to understand
3. **Paste freely**: Don't worry about formatting - just paste transcripts, notes, etc.
4. **Point to files**: Reference files in your filesystem - the model can read them
5. **Review evidence**: Check what the model gathered to ensure it's relevant

## Why This Approach Works

### 1. Leverages Full Model Capabilities

Models like Claude, ChatGPT, and others have powerful built-in capabilities:
- Web search and browsing
- File system access
- Code analysis
- Natural language understanding
- Synthesis and summarization

By letting models use these capabilities directly, we get the full benefit of their intelligence.

### 2. Platform Agnostic

This approach works across different platforms:
- **Cursor**: Claude can read files in your workspace
- **Claude Desktop**: Can access files and use MCP tools
- **ChatGPT**: Can browse the web and analyze pasted content

RiotPlan doesn't need to know which platform it's running on.

### 3. Future-Proof

As models get better capabilities (better search, better analysis, new tools), RiotPlan automatically benefits without needing updates.

### 4. Keeps RiotPlan Simple

RiotPlan doesn't need to:
- Implement web search
- Parse different file formats
- Analyze code
- Determine relevance

It just provides structure for capturing what models find.

### 5. Creates True Collaboration

The model is not just executing commands - it's actively participating in the ideation process by:
- Finding relevant information
- Making judgments about relevance
- Synthesizing findings
- Organizing evidence

This is a true symbiotic relationship.

## Future Enhancements

Potential future capabilities:

1. **Evidence clustering**: Group related evidence together
2. **Evidence search**: Find evidence by content or metadata
3. **Evidence visualization**: Show evidence relationships
4. **Evidence quality scoring**: Track which evidence was most useful
5. **Cross-plan evidence**: Reference evidence from other plans
6. **Evidence expiration**: Mark evidence as outdated

But the core principle remains: **RiotPlan captures, models gather**.
