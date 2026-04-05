import { AgentSkill } from './types';

function parseFrontMatter(content: string): { frontMatter: Record<string, any>, body: string } {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) {
        return { frontMatter: {}, body: content };
    }

    const fmText = fmMatch[1];
    const body = fmMatch[2];
    const frontMatter: Record<string, string> = {};

    fmText.split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length > 0) {
            frontMatter[key.trim()] = rest.join(':').trim().replace(/^['"](.*)['"]$/, '$1');
        }
    });

    return { frontMatter, body };
}

export function discoverSkills(filesystem: Record<string, string>): AgentSkill[] {
    const skills: AgentSkill[] = [];
    const skillFiles = Object.keys(filesystem).filter(path => path.endsWith('/SKILL.md'));

    for (const skillFile of skillFiles) {
        const skillDir = skillFile.replace(/\/SKILL\.md$/, '');
        const content = filesystem[skillFile];
        const { frontMatter, body } = parseFrontMatter(content);

        if (frontMatter.name && frontMatter.description) {
            skills.push({
                name: frontMatter.name,
                description: frontMatter.description,
                instructions: body,
                path: skillDir,
                metadata: frontMatter.metadata ? JSON.parse(frontMatter.metadata) : undefined
            });
        }
    }

    return skills;
}
