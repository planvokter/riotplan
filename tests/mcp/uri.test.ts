import { describe, expect, it } from 'vitest';
import { buildUri, parseUri } from '../../src/mcp/uri.js';

describe('mcp uri helpers', () => {
    it('parses uri with path and query', () => {
        const parsed = parseUri('riotplan://step/demo-plan?number=3');
        expect(parsed.scheme).toBe('riotplan');
        expect(parsed.type).toBe('step');
        expect(parsed.path).toBe('demo-plan');
        expect(parsed.query).toEqual({ number: '3' });
    });

    it('parses uri without path/query', () => {
        const parsed = parseUri('riotplan://status');
        expect(parsed.type).toBe('status');
        expect(parsed.path).toBeUndefined();
        expect(parsed.query).toBeUndefined();
    });

    it('throws for non-riotplan scheme', () => {
        expect(() => parseUri('https://example.com')).toThrow('Invalid riotplan URI');
    });

    it('builds uri with path and query', () => {
        const uri = buildUri('artifact', 'demo-plan', { type: 'summary', include: 'all' });
        expect(uri).toBe('riotplan://artifact/demo-plan?type=summary&include=all');
    });

    it('builds uri without optional parts', () => {
        const uri = buildUri('status');
        expect(uri).toBe('riotplan://status');
    });
});
