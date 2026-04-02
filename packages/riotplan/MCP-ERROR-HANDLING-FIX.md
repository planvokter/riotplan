# MCP Server Stdout Pollution Fix

## Issue

The RiotPlan MCP server was crashing with the error:

```
Unexpected token 'C', "Config fil"... is not valid JSON
```

This was caused by stdout pollution corrupting the MCP JSON-RPC protocol stream.

## Root Cause

MCP uses stdio (stdin/stdout) for JSON-RPC communication. Any output to stdout - even from dependencies like CardiganTime - corrupts the protocol stream, causing the client to receive invalid JSON.

The error message `"Config fil"...` was actually the beginning of a log message like "Config file not found..." that was being written to stdout and mixing with the JSON-RPC messages.

## Solution

### Stdout Suppression

Redirected all stdout to stderr in MCP mode to prevent pollution of the JSON-RPC stream:

```typescript
// Suppress stdout to prevent pollution of MCP JSON-RPC stream
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
    // Redirect to stderr instead
    return process.stderr.write(chunk, encoding, callback);
};
```

This ensures:
- MCP JSON-RPC protocol remains clean on stdout
- All logs (from RiotPlan and dependencies) go to stderr
- No corruption of the protocol stream

### Enhanced Error Handling

Also improved error messages throughout:

1. **Better Config Error Messages** (`src/config/loader.ts`)
   - Specific error handling for JSON parsing errors
   - Specific error handling for validation errors
   - Helpful troubleshooting tips
   - Full error context

2. **Improved Server Error Handling** (`src/mcp/server.ts`)
   - Centralized error logging with timestamps
   - Try-catch wrapper around tool execution
   - Global process error handlers
   - Full stack traces in error responses

## Files Changed

- `src/mcp/server.ts` - Stdout suppression and error handling
- `src/config/loader.ts` - Enhanced error messages

## Testing

All 666 tests pass. The MCP server now properly isolates stdout for the JSON-RPC protocol.
