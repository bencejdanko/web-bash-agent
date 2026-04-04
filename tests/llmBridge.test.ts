import { describe, it, expect, vi } from 'vitest';
import { LlmBridge } from '../src/llmBridge';

describe('LlmBridge', () => {
    it('should configure OpenAI with run tool', () => {
        const bridge = new LlmBridge({ apiKey: 'dummy', dangerouslyAllowBrowser: true });
        const tools = bridge.getToolDefinitions();
        
        expect(tools).toHaveLength(1);
        expect(tools[0].function.name).toBe('run_terminal_command');
        expect(tools[0].function.parameters.properties).toHaveProperty('command');
    });

    it('should have a system prompt instructions for bash tools', () => {
        const bridge = new LlmBridge({ apiKey: 'dummy', dangerouslyAllowBrowser: true });
        const prompt = bridge.getSystemPrompt();
        
        expect(prompt).toContain('ls');
        expect(prompt).toContain('grep');
        expect(prompt).toContain('cat');
        expect(prompt).toContain('Virtual Bash Filesystem');
    });
});
