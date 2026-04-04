import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TerminalWindow } from '../src/TerminalWindow';
import React from 'react';

describe('TerminalWindow', () => {
    it('renders a command and its output', () => {
        render(<TerminalWindow command="ls /api" output="projects.json\nblog.json" />);
        
        expect(screen.getByText(/ls \/api/)).toBeInTheDocument();
        expect(screen.getByText(/projects.json/)).toBeInTheDocument();
        expect(screen.getByText(/blog.json/)).toBeInTheDocument();
    });

    it('renders as a sidebar window', () => {
        const { container } = render(<TerminalWindow command="ls" output="" />);
        const sidebar = container.firstChild as HTMLElement;
        expect(sidebar).toHaveStyle({ position: 'fixed', right: '20px' });
    });
});
