import { describe, expect, it } from 'vitest';
import { getPrompt, getPrompts } from '../../src/mcp/prompts/index.js';

describe('mcp prompts index', () => {
    it('lists expected prompt definitions', () => {
        const prompts = getPrompts();
        const names = prompts.map((p) => p.name);
        expect(names).toEqual([
            'explore_idea',
            'shape_approach',
            'create_plan',
            'develop_plan',
            'execute_plan',
            'execute_step',
            'track_progress',
        ]);
    });

    it('throws for unknown prompt names', async () => {
        await expect(getPrompt('does-not-exist', {})).rejects.toThrow('Unknown prompt: does-not-exist');
    });

    it('fills explore_idea defaults when args are missing', async () => {
        const messages = await getPrompt('explore_idea', {});
        const text = messages[0]?.content?.type === 'text' ? messages[0].content.text : '';
        expect(text.length).toBeGreaterThan(200);
        expect(text).toContain('# Explore Idea');
    });

    it('fills create_plan defaults for optional args', async () => {
        const messages = await getPrompt('create_plan', {});
        const text = messages[0]?.content?.type === 'text' ? messages[0].content.text : '';
        expect(text).toContain('[code]');
        expect(text).toContain('[description]');
        expect(text).toContain('[project-id]');
        expect(text).toContain('[steps]');
    });

    it('uses provided args without overriding explicit planId', async () => {
        const messages = await getPrompt('execute_step', { planId: 'abc-plan' });
        const text = messages[0]?.content?.type === 'text' ? messages[0].content.text : '';
        expect(text).toContain('abc-plan');
        expect(text).not.toContain('[current-plan-id]');
    });
});
