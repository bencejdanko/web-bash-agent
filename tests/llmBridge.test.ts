/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { LlmBridge } from '../src/llmBridge';

describe('LlmBridge', () => {
    it('should configure OpenAI with bash tool', () => {
        const bridge = new LlmBridge({ apiKey: 'dummy', dangerouslyAllowBrowser: true });
        const tools = bridge.getToolDefinitions();
        
        expect(tools).toHaveLength(1);
        expect(tools[0].function.name).toBe('bash');
        expect(tools[0].function.parameters.properties).toHaveProperty('command');
        expect(tools[0].function.parameters.required).toContain('command');
    });

    it('should have a system prompt describing the bash environment', () => {
        const bridge = new LlmBridge({ apiKey: 'dummy', dangerouslyAllowBrowser: true });
        const prompt = bridge.getSystemPrompt();
        
        expect(prompt).toContain('/site/');
        expect(prompt).toContain('bash');
        expect(prompt).toContain('grep');
        expect(prompt).toContain('find');
        expect(prompt).toContain('search');
    });

    it('should include helpful commands in the tool description', () => {
        const bridge = new LlmBridge({ apiKey: 'dummy', dangerouslyAllowBrowser: true });
        const tools = bridge.getToolDefinitions();
        const description = tools[0].function.description;
        
        expect(description).toContain('jq');
        expect(description).toContain('Pagefind');
        expect(description).toContain('search');
    });
});
