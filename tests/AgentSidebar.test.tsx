import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentSidebar } from '../src/AgentSidebar';
import React from 'react';

describe('AgentSidebar', () => {
    it('triggers run and displays terminal output', async () => {
        const mockRun = vi.fn().mockResolvedValue('projects.json');
        const mockChat = vi.fn()
            .mockResolvedValueOnce({
                message: {
                    content: 'Checking...',
                    role: 'assistant',
                    tool_calls: [{
                        id: '1',
                        function: { name: 'run_terminal_command', arguments: JSON.stringify({ command: 'ls /api' }) }
                    }]
                }
            })
            .mockResolvedValueOnce({
                message: {
                    role: 'assistant',
                    content: 'I found the projects.',
                }
            });

        const mockBashEngine = {
            run: mockRun
        };

        const mockLlmBridge = {
            chat: mockChat,
            getToolDefinitions: () => [],
            getSystemPrompt: () => 'System Prompt'
        };

        render(<AgentSidebar bashEngine={mockBashEngine as any} llmBridge={mockLlmBridge as any} />);

        const input = screen.getByPlaceholderText(/Ask anything/i);
        fireEvent.change(input, { target: { value: 'What projects do you have?' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(mockRun).toHaveBeenCalledWith('ls /api');
        }, { timeout: 3000 });

        // ls /api only in terminal
        expect(screen.getByText(/ls \/api/)).toBeInTheDocument();
        
        // Final message
        expect(screen.getByText(/I found the projects./)).toBeInTheDocument();
    });
});
