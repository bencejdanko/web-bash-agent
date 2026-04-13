import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { parseInjections } from './PromptAssembler';
import { AgentInjection } from '../types';
import { FileIcon, FolderIcon } from './components/Icons';

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

function getIconForType(type: string, _value: string): string {
    return FileIcon(14);
}

export function renderWithHighlights(
    content: string, 
    assets: AgentInjection[] = [], 
    filesystem: Record<string, string> = {}
): string {
    const injections = parseInjections(content);
    
    let contentWithPlaceholders = content;
    const placeholders: Record<string, string> = {};

    injections.forEach((inj, idx) => {
        let isValid = false;
        let className = '';
        
        if (inj.type === 'file') {
            isValid = filesystem[inj.value] !== undefined;
            className = 'file-tag';
        } else {
            isValid = !!assets.find(a => a.name === inj.value && a.type === inj.type);
            className = inj.type === 'system' ? 'system-tag' : 'skill-tag';
        }

        if (isValid) {
            const icon = getIconForType(inj.type, inj.value);
            const placeholder = `{{TAG_INJECTION_${idx}}}`;
            // Chip with icon + label
            placeholders[placeholder] = `<span class="tag-highlight ${className}">${icon}${inj.fullMatch}</span>`;
            contentWithPlaceholders = contentWithPlaceholders.split(inj.fullMatch).join(placeholder);
        }
    });

    let renderedHtml = renderMarkdown(contentWithPlaceholders);

    for (const [placeholder, replacement] of Object.entries(placeholders)) {
        renderedHtml = renderedHtml.split(placeholder).join(replacement);
    }

    return renderedHtml;
}
