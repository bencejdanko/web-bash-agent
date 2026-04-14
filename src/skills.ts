import { AgentInjection } from './types';

/**
 * Robust frontmatter parser that handles different line endings and edge cases.
 */
export function parseAgentMarkdown(content: string): { frontMatter: Record<string, any>, body: string } {
    const lines = content.split(/\r?\n/);
    
    let firstLineIdx = 0;
    while (firstLineIdx < lines.length && lines[firstLineIdx].trim() === '') {
        firstLineIdx++;
    }

    if (firstLineIdx >= lines.length || lines[firstLineIdx].trim() !== '---') {
        return { frontMatter: {}, body: content };
    }

    const frontMatter: Record<string, string> = {};
    let i = firstLineIdx + 1;
    let foundEnd = false;

    for (; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') {
            foundEnd = true;
            break;
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim()
                .replace(/^['"](.*)['"]$/, '$1'); // Remove surrounding quotes
            frontMatter[key] = value;
        }
    }

    if (!foundEnd) {
        return { frontMatter: {}, body: content };
    }

    const body = lines.slice(i + 1).join('\n').trim();
    return { frontMatter, body };
}

export function discoverInjections(filesystem: Record<string, string>): AgentInjection[] {
    const injections: AgentInjection[] = [];
    
    for (const [p, content] of Object.entries(filesystem)) {
        const lp = p.toLowerCase();
        const isSkillFile = lp.endsWith('/skill.md') || lp === 'skill.md';
        const isSystemFile = lp.endsWith('/system.md') || lp === 'system.md';
        
        if (!isSkillFile && !isSystemFile) continue;

        const type = isSystemFile ? 'system' : 'skill';
        const assetDir = p.replace(/\/(skill|system|SKILL|SYSTEM)\.md$/i, '');
        const { frontMatter, body } = parseAgentMarkdown(content);

        const name = frontMatter.name || assetDir.split('/').pop() || `Untitled ${type}`;
        const description = frontMatter.description || '';

        injections.push({
            type,
            name,
            description,
            instructions: body,
            path: assetDir,
            metadata: frontMatter
        });
    }

    return injections;
}
