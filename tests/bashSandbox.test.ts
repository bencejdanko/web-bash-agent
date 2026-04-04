/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { BashSandbox } from '../src/bashSandbox';

describe('BashSandbox', () => {
  const mockFilesystem = {
    '/projects/project-a.json': JSON.stringify({ name: 'Project A', description: 'A cool project', tech: ['TypeScript'] }),
    '/projects/project-b.json': JSON.stringify({ name: 'Project B', description: 'Another project', tech: ['Rust', 'Python'] }),
    '/about.md': '# About\n\nThis is a test site.\n',
  };

  it('should list files with ls', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('ls /site/projects');
    expect(result.stdout).toContain('project-a.json');
    expect(result.stdout).toContain('project-b.json');
    expect(result.exitCode).toBe(0);
  });

  it('should support ls -la', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('ls -la /site/projects');
    expect(result.stdout).toContain('project-a.json');
    expect(result.exitCode).toBe(0);
  });

  it('should cat file contents', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('cat /site/projects/project-a.json');
    expect(result.stdout).toContain('Project A');
    expect(result.stdout).toContain('cool project');
    expect(result.exitCode).toBe(0);
  });

  it('should support find to discover files', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('find /site -name "*.json"');
    expect(result.stdout).toContain('project-a.json');
    expect(result.stdout).toContain('project-b.json');
    expect(result.exitCode).toBe(0);
  });

  it('should support grep -r within files', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('grep -r "cool" /site/');
    expect(result.stdout).toContain('cool project');
    expect(result.exitCode).toBe(0);
  });

  it('should support grep -i for case-insensitive search', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('grep -ri "PROJECT A" /site/');
    expect(result.stdout).toContain('Project A');
    expect(result.exitCode).toBe(0);
  });

  it('should support pipes', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('cat /site/projects/project-a.json | grep "name"');
    expect(result.stdout).toContain('Project A');
    expect(result.exitCode).toBe(0);
  });

  it('should support head and tail', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('cat /site/about.md | head -1');
    expect(result.stdout).toContain('# About');
    expect(result.exitCode).toBe(0);
  });

  it('should count files with wc', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('find /site -name "*.json" | wc -l');
    expect(result.stdout.trim()).toBe('2');
    expect(result.exitCode).toBe(0);
  });

  it('should include README.md in /site/', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('cat /site/README.md');
    expect(result.stdout).toContain('Site Content');
    expect(result.exitCode).toBe(0);
  });

  it('should start in /site/ cwd', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('pwd');
    expect(result.stdout.trim()).toBe('/site');
    expect(result.exitCode).toBe(0);
  });

  it('should support the custom search command with pagefind', async () => {
    const mockPagefind = {
      search: vi.fn().mockResolvedValue({
        results: [
          {
            data: async () => ({
              url: '/projects/project-a',
              meta: { title: 'Project A' },
              excerpt: 'A <mark>cool</mark> project',
            }),
          },
        ],
      }),
    };

    const sandbox = new BashSandbox({ files: mockFilesystem, pagefind: mockPagefind });
    const result = await sandbox.exec('search cool project');
    expect(mockPagefind.search).toHaveBeenCalledWith('cool project');
    expect(result.stdout).toContain('Project A');
    expect(result.exitCode).toBe(0);
  });

  it('should handle search with no pagefind gracefully', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('search something');
    expect(result.stderr).toContain('Pagefind');
    expect(result.exitCode).toBe(1);
  });

  it('should show usage for search with no query', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('search');
    expect(result.stderr).toContain('Usage');
    expect(result.exitCode).toBe(1);
  });

  it('should support site-help command', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('site-help');
    expect(result.stdout).toContain('Site Explorer');
    expect(result.stdout).toContain('search');
    expect(result.exitCode).toBe(0);
  });

  it('should handle unknown commands gracefully', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('nonexistent-command');
    expect(result.exitCode).not.toBe(0);
  });

  it('should support command chaining with &&', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    const result = await sandbox.exec('ls /site/projects && echo "done"');
    expect(result.stdout).toContain('project-a.json');
    expect(result.stdout).toContain('done');
    expect(result.exitCode).toBe(0);
  });

  it('should persist filesystem across exec calls', async () => {
    const sandbox = new BashSandbox({ files: mockFilesystem });
    await sandbox.exec('echo "new content" > /site/new-file.txt');
    const result = await sandbox.exec('cat /site/new-file.txt');
    expect(result.stdout).toContain('new content');
    expect(result.exitCode).toBe(0);
  });
});
