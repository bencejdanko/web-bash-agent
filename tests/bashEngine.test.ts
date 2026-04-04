import { describe, it, expect, vi } from 'vitest';
import { BashEngine } from '../src/bashEngine';

describe('BashEngine', () => {
  const mockFilesystem = {
    '/api/projects.json': 'Projects overview',
    '/api/blog.json': 'Latest news',
  };

  const mockPagefind = {
    search: vi.fn(),
  };

  it('should list files in /api', async () => {
    const engine = new BashEngine(mockFilesystem, mockPagefind as any);
    const output = await engine.run('ls /api');
    expect(output).toContain('projects.json');
    expect(output).toContain('blog.json');
  });

  it('should grep content using pagefind', async () => {
    mockPagefind.search.mockResolvedValue({
      results: [
        { data: async () => ({ url: '/api/projects.json', excerpt: 'Found accessibility match here' }) },
      ],
    });

    const engine = new BashEngine(mockFilesystem, mockPagefind as any);
    const output = await engine.run('grep -i "accessibility" /api/*');
    
    expect(mockPagefind.search).toHaveBeenCalledWith('accessibility');
    expect(output).toContain('/api/projects.json: Found accessibility match here');
  });

  it('should cat file content', async () => {
    const engine = new BashEngine(mockFilesystem, mockPagefind as any);
    const output = await engine.run('cat /api/projects.json');
    expect(output).toBe('Projects overview');
  });

  it('should handle unknown commands', async () => {
    const engine = new BashEngine(mockFilesystem, mockPagefind as any);
    const output = await engine.run('rm -rf /');
    expect(output).toBe('bash: rm: command not found');
  });

  it('should handle cat on non-existent file', async () => {
    const engine = new BashEngine(mockFilesystem, mockPagefind as any);
    const output = await engine.run('cat /api/unknown.json');
    expect(output).toContain('Network error or file not found');
  });
});
