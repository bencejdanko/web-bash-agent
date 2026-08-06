import { describe, it, expect, beforeEach } from 'vitest';
import { Sandbox } from './Sandbox';

describe('Sandbox Autocomplete (getCompletions)', () => {
    let sandbox: Sandbox;

    beforeEach(async () => {
        sandbox = new Sandbox({
            cwd: '/home/user',
            customCommands: [{ name: 'customTool' }]
        });

        // Set up dummy test files and directories in sandbox fs
        await sandbox.fs.mkdir('/home/user/projects', { recursive: true });
        await sandbox.fs.mkdir('/home/user/photos', { recursive: true });
        await sandbox.fs.writeFile('/home/user/package.json', '{}');
        await sandbox.fs.writeFile('/home/user/paper.pdf', 'pdf data');
        await sandbox.fs.writeFile('/home/user/readme.md', '# Hello');
    });

    describe('Command completion', () => {
        it('should complete single matching command (e.g. py -> python)', async () => {
            const res = await sandbox.getCompletions('py');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('python ');
            expect(res.matches).toEqual(['python']);
        });

        it('should complete custom registered commands (e.g. custom -> customTool)', async () => {
            const res = await sandbox.getCompletions('custom');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('customTool ');
            expect(res.matches).toEqual(['customTool']);
        });

        it('should return longest common prefix for multiple matching commands', async () => {
            const res = await sandbox.getCompletions('c');
            expect(res.isSingleMatch).toBe(false);
            expect(res.completedLine).toBe('c');
            expect(res.matches).toContain('cat');
            expect(res.matches).toContain('cd');
            expect(res.matches).toContain('clear');
            expect(res.matches).toContain('cp');
        });
    });

    describe('Path and File completion', () => {
        it('should complete single file match with trailing space (e.g. cat read -> cat readme.md )', async () => {
            const res = await sandbox.getCompletions('cat read');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('cat readme.md ');
            expect(res.matches).toEqual(['readme.md']);
        });

        it('should complete single directory match with trailing slash and no space (e.g. cd proj -> cd projects/)', async () => {
            const res = await sandbox.getCompletions('cd proj');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('cd projects/');
            expect(res.matches).toEqual(['projects/']);
        });

        it('should handle LCP for multiple file/directory matches (e.g. cat pa -> cat pap)', async () => {
            const res = await sandbox.getCompletions('cat pa');
            expect(res.isSingleMatch).toBe(false);
            expect(res.completedLine).toBe('cat pa'); // package.json, paper.pdf -> LCP 'pa'
            expect(res.matches).toEqual(['package.json', 'paper.pdf']);
        });

        it('should complete nested path entries (e.g. cd projects/)', async () => {
            await sandbox.fs.writeFile('/home/user/projects/app.ts', 'console.log()');
            const res = await sandbox.getCompletions('cat projects/ap');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('cat projects/app.ts ');
        });

        it('should complete paths starting with ~/', async () => {
            const res = await sandbox.getCompletions('ls ~/read');
            expect(res.isSingleMatch).toBe(true);
            expect(res.completedLine).toBe('ls ~/readme.md ');
        });
    });
});
