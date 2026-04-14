export class PromptAssembler {
    static assemble(
        userInput: string, 
        injections: AgentInjection[], 
        filesystem: Record<string, string>
    ): string {
        const matches = parseInjections(userInput);
        
        // We replace tags in-place with their content.
        let finalPrompt = userInput;

        // Sort by length descending to handle overlapping mentions safely
        matches.sort((a, b) => b.fullMatch.length - a.fullMatch.length);

        for (const match of matches) {
            let content = '';
            if (match.type === 'file') {
                // A path is a directory when any key in the filesystem starts with "path/"
                const dirPrefix = match.value + '/';
                const isDir = Object.keys(filesystem).some(k => k.startsWith(dirPrefix));

                if (isDir) {
                    // Folder reference: list all direct children
                    const children = Object.keys(filesystem)
                        .filter(k => k.startsWith(dirPrefix))
                        .sort();
                    if (children.length > 0) {
                        const listing = children.join('\n');
                        content = `\n\n[FOLDER LISTING: ${match.value}]\n${listing}\n[END FOLDER LISTING]\n\n`;
                    }
                } else {
                    const fileContent = filesystem[match.value];
                    content = fileContent !== undefined
                        ? `\n\n[FILE INJECTION: ${match.value}]\n${fileContent}\n[END FILE INJECTION]\n\n`
                        : '';
                }
            } else {
                // Matches either 'system' or 'skill' type
                const asset = injections.find(i => i.name === match.value && i.type === match.type);
                if (asset) {
                    const typeLabel = asset.type.toUpperCase();
                    content = `\n\n[${typeLabel} INJECTION: ${asset.name}]\n${asset.instructions}\n[END ${typeLabel} INJECTION]\n\n`;
                }
            }

            if (content) {
                finalPrompt = finalPrompt.split(match.fullMatch).join(content);
            }
        }

        return finalPrompt;
    }
}

/**
 * Robust parser for extracting tag injections from user input.
 */
export interface TagMatch {
    type: 'system' | 'skill' | 'file';
    value: string;
    fullMatch: string;
}

/**
 * Re-exporting AgentInjection here for convenience or keeping it in types.ts
 * Since PromptAssembler uses it heavily.
 */
import { AgentInjection as AI } from '../types';
export type AgentInjection = AI;

export function parseInjections(input: string): TagMatch[] {
    const matches: TagMatch[] = [];
    const triggers = [
        { type: 'system', prefix: '#system:', allowSlash: false },
        { type: 'skill',  prefix: '/skill:',  allowSlash: false },
        // File paths contain '/' so we must not stop at '/'
        { type: 'file',   prefix: '@file:',   allowSlash: true  }
    ] as const;

    for (const trigger of triggers) {
        let currentPos = 0;
        while ((currentPos = input.indexOf(trigger.prefix, currentPos)) !== -1) {
            const valueStart = currentPos + trigger.prefix.length;
            let valueEnd = valueStart;

            // Match until a stopping character.
            // File paths may contain '/' so only stop at whitespace / other trigger chars.
            // Skill/system names don't contain slashes so stop at '/' too.
            while (valueEnd < input.length) {
                const char = input[valueEnd];
                if (char === ' ' || char === '\n' || char === '@' || char === '#') {
                    break;
                }
                // For skill/system, '/' marks the start of another trigger
                if (!trigger.allowSlash && char === '/') {
                    break;
                }
                valueEnd++;
            }

            const value = input.substring(valueStart, valueEnd).trim();
            if (value) {
                matches.push({
                    type: trigger.type,
                    value,
                    fullMatch: input.substring(currentPos, valueEnd)
                });
            }
            currentPos = Math.max(currentPos + 1, valueEnd);
        }
    }

    return matches;
}
