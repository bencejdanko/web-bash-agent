import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { parseInjections } from './PromptAssembler';
import { AgentInjection } from '../types';

const marked = new Marked(
    markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    })
);

export function renderMarkdown(content: string): string {
    return marked.parse(content) as string;
}

export function renderWithHighlights(
    content: string, 
    assets: AgentInjection[] = [], 
    filesystem: Record<string, string> = {}
): string {
    const injections = parseInjections(content);
    
    // Most robust way: 
    // 1. Find all valid injections in the RAW content.
    // 2. Wrap them in a UNIQUE placeholder.
    // 3. Render markdown.
    // 4. Replace placeholders with HTML.

    let contentWithPlaceholders = content;
    const placeholders: Record<string, string> = {};

    injections.forEach((inj, idx) => {
        let isValid = false;
        let className = '';
        
        if (inj.type === 'file') {
            isValid = filesystem[inj.value] !== undefined;
            className = 'file-tag';
        } else {
            // Matches 'system' or 'skill'
            isValid = !!assets.find(a => a.name === inj.value && a.type === inj.type);
            className = inj.type === 'system' ? 'system-tag' : 'skill-tag';
        }

        if (isValid) {
            const placeholder = `{{TAG_INJECTION_${idx}}}`;
            placeholders[placeholder] = `<span class="tag-highlight ${className}">${inj.fullMatch}</span>`;
            contentWithPlaceholders = contentWithPlaceholders.split(inj.fullMatch).join(placeholder);
        }
    });

    let renderedHtml = renderMarkdown(contentWithPlaceholders);

    // Swap back
    for (const [placeholder, replacement] of Object.entries(placeholders)) {
        renderedHtml = renderedHtml.split(placeholder).join(replacement);
    }

    return renderedHtml;
}
