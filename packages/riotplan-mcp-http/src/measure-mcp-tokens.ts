/**
 * MCP Definition Token Cost Measurement
 *
 * Measures the token cost of all MCP tool, resource, and prompt definitions
 * as they appear in the wire format sent to clients. This is the authoritative
 * metric for tracking RiotPlan's MCP footprint over time.
 *
 * Usage:
 *   npx tsx src/measure-mcp-tokens.ts          # Print report to stdout
 *   npx tsx src/measure-mcp-tokens.ts --json    # Output JSON for CI
 *   npx tsx src/measure-mcp-tokens.ts --ci      # Output JSON + write to mcp-token-report.json
 */

import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tools } from './tools/index.js';
import { getResources } from './resources/index.js';
import { getPrompts } from './prompts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Token counting
// ---------------------------------------------------------------------------

/**
 * Estimate token count for JSON Schema content.
 *
 * JSON Schema is token-dense: short structural tokens like {, }, :, "
 * compress well, but property names, descriptions, and enum values
 * are normal tokens. We use 3.0 chars/token as a conservative
 * middle ground between natural language (~4.0) and pure code (~2.5).
 *
 * Note: This measures the wire-format JSON only. The actual token cost
 * in a model's context window may be higher due to:
 * - MCP protocol framing (method, id, jsonrpc fields)
 * - Client-side formatting and tool presentation
 * - System prompt references to available tools
 *
 * For a more precise measurement, capture the actual tools/list response
 * from a running server and count with tiktoken.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.0);
}

// ---------------------------------------------------------------------------
// Schema serialization (mirrors server-hono.ts schemaToJsonSchema)
// ---------------------------------------------------------------------------

function schemaToJsonSchema(schema: z.ZodRawShape): Record<string, unknown> {
  const zodSchema = z.object(schema);
  const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
  if (!jsonSchema.type) jsonSchema.type = 'object';
  return jsonSchema;
}

// ---------------------------------------------------------------------------
// Measurement types
// ---------------------------------------------------------------------------

interface DefinitionCost {
  name: string;
  category: 'tool' | 'resource' | 'prompt';
  tokenEstimate: number;
  charCount: number;
  jsonSize: number; // bytes of the serialized JSON
}

interface TokenReport {
  timestamp: string;
  version: string;
  summary: {
    totalTokens: number;
    totalTools: number;
    totalResources: number;
    totalPrompts: number;
    totalDefinitions: number;
    toolTokens: number;
    resourceTokens: number;
    promptTokens: number;
  };
  tools: DefinitionCost[];
  resources: DefinitionCost[];
  prompts: DefinitionCost[];
  /** The full wire-format JSON as sent by tools/list + resources/list + prompts/list */
  wireFormatSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function measureTools(): DefinitionCost[] {
  return tools.map((tool) => {
    const wireFormat = {
      name: tool.name,
      description: tool.description,
      inputSchema: schemaToJsonSchema(tool.schema),
    };
    const json = JSON.stringify(wireFormat);
    return {
      name: tool.name,
      category: 'tool' as const,
      tokenEstimate: estimateTokens(json),
      charCount: json.length,
      jsonSize: Buffer.byteLength(json, 'utf-8'),
    };
  });
}

function measureResources(): DefinitionCost[] {
  const resources = getResources();
  return resources.map((r) => {
    const wireFormat = {
      uri: r.uri,
      name: r.name,
      description: r.description || '',
      mimeType: r.mimeType,
    };
    const json = JSON.stringify(wireFormat);
    return {
      name: r.name,
      category: 'resource' as const,
      tokenEstimate: estimateTokens(json),
      charCount: json.length,
      jsonSize: Buffer.byteLength(json, 'utf-8'),
    };
  });
}

function measurePrompts(): DefinitionCost[] {
  const prompts = getPrompts();
  return prompts.map((p) => {
    const wireFormat = {
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    };
    const json = JSON.stringify(wireFormat);
    return {
      name: p.name,
      category: 'prompt' as const,
      tokenEstimate: estimateTokens(json),
      charCount: json.length,
      jsonSize: Buffer.byteLength(json, 'utf-8'),
    };
  });
}

function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function generateReport(): TokenReport {
  const toolCosts = measureTools();
  const resourceCosts = measureResources();
  const promptCosts = measurePrompts();

  const toolTokens = toolCosts.reduce((sum, t) => sum + t.tokenEstimate, 0);
  const resourceTokens = resourceCosts.reduce((sum, r) => sum + r.tokenEstimate, 0);
  const promptTokens = promptCosts.reduce((sum, p) => sum + p.tokenEstimate, 0);

  // Calculate the full wire format size (what actually goes over the wire)
  const toolsWire = JSON.stringify({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: schemaToJsonSchema(tool.schema),
    })),
  });

  const resourcesWire = JSON.stringify({
    resources: getResources().map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description || '',
      mimeType: r.mimeType,
    })),
  });

  const promptsWire = JSON.stringify({
    prompts: getPrompts().map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    })),
  });

  const totalWireBytes =
    Buffer.byteLength(toolsWire, 'utf-8') +
    Buffer.byteLength(resourcesWire, 'utf-8') +
    Buffer.byteLength(promptsWire, 'utf-8');

  return {
    timestamp: new Date().toISOString(),
    version: getVersion(),
    summary: {
      totalTokens: toolTokens + resourceTokens + promptTokens,
      totalTools: toolCosts.length,
      totalResources: resourceCosts.length,
      totalPrompts: promptCosts.length,
      totalDefinitions: toolCosts.length + resourceCosts.length + promptCosts.length,
      toolTokens,
      resourceTokens,
      promptTokens,
    },
    tools: toolCosts.sort((a, b) => b.tokenEstimate - a.tokenEstimate),
    resources: resourceCosts.sort((a, b) => b.tokenEstimate - a.tokenEstimate),
    prompts: promptCosts.sort((a, b) => b.tokenEstimate - a.tokenEstimate),
    wireFormatSizeBytes: totalWireBytes,
  };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatReport(report: TokenReport): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push('  RiotPlan MCP Token Cost Report');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`  Version:     ${report.version}`);
  lines.push(`  Timestamp:   ${report.timestamp}`);
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('  Summary');
  lines.push('─'.repeat(60));
  lines.push(`  Total definitions:  ${report.summary.totalDefinitions}`);
  lines.push(`  Total token estimate: ${report.summary.totalTokens.toLocaleString()} tokens`);
  lines.push(`  Wire format size:    ${(report.wireFormatSizeBytes / 1024).toFixed(1)} KB`);
  lines.push('');
  lines.push(`  Tools:     ${report.summary.totalTools} definitions → ${report.summary.toolTokens.toLocaleString()} tokens`);
  lines.push(`  Resources: ${report.summary.totalResources} definitions → ${report.summary.resourceTokens.toLocaleString()} tokens`);
  lines.push(`  Prompts:   ${report.summary.totalPrompts} definitions → ${report.summary.promptTokens.toLocaleString()} tokens`);
  lines.push('');

  // Context window impact
  const pct128k = ((report.summary.totalTokens / 128000) * 100).toFixed(1);
  const pct200k = ((report.summary.totalTokens / 200000) * 100).toFixed(1);
  lines.push(`  % of 128K context:   ${pct128k}%`);
  lines.push(`  % of 200K context:   ${pct200k}%`);
  lines.push('');

  lines.push('─'.repeat(60));
  lines.push('  Tools (sorted by token cost, highest first)');
  lines.push('─'.repeat(60));
  for (const tool of report.tools) {
    lines.push(`  ${tool.name.padEnd(40)} ${String(tool.tokenEstimate).padStart(6)} tokens  (${tool.jsonSize} bytes)`);
  }
  lines.push('');

  lines.push('─'.repeat(60));
  lines.push('  Resources (sorted by token cost, highest first)');
  lines.push('─'.repeat(60));
  for (const resource of report.resources) {
    lines.push(`  ${resource.name.padEnd(40)} ${String(resource.tokenEstimate).padStart(6)} tokens  (${resource.jsonSize} bytes)`);
  }
  lines.push('');

  lines.push('─'.repeat(60));
  lines.push('  Prompts (sorted by token cost, highest first)');
  lines.push('─'.repeat(60));
  for (const prompt of report.prompts) {
    lines.push(`  ${prompt.name.padEnd(40)} ${String(prompt.tokenEstimate).padStart(6)} tokens  (${prompt.jsonSize} bytes)`);
  }
  lines.push('');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const isCi = args.includes('--ci');

const report = generateReport();

if (isJson || isCi) {
  const json = JSON.stringify(report, null, 2);
  console.log(json);

  if (isCi) {
    const outPath = resolve(__dirname, '..', 'mcp-token-report.json');
    writeFileSync(outPath, json);
    console.error(`\nReport written to ${outPath}`);
  }
} else {
  console.log(formatReport(report));
}
