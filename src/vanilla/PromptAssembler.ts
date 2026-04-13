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
                const fileContent = filesystem[match.value];
                content = fileContent !== undefined ? `\n\n[FILE INJECTION: ${match.value}]\n${fileContent}\n[END FILE INJECTION]\n\n` : '';
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
        { type: 'system', prefix: '#system:' },
        { type: 'skill', prefix: '/skill:' },
        { type: 'file', prefix: '@file:' }
    ] as const;

    for (const trigger of triggers) {
        let currentPos = 0;
        while ((currentPos = input.indexOf(trigger.prefix, currentPos)) !== -1) {
            const valueStart = currentPos + trigger.prefix.length;
            let valueEnd = valueStart;

            // Match until next trigger char, space, or newline
            while (valueEnd < input.length) {
                const char = input[valueEnd];
                if (char === ' ' || char === '\n' || char === '#' || char === '/' || char === '@') {
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
