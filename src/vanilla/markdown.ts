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
        let icon = FileIcon(14);
        
        if (inj.type === 'file') {
            // A path is a directory when any key in the filesystem starts with "path/"
            // (filesystem keys never end with '/', so trailing-slash check is wrong here)
            const dirPrefix = inj.value + '/';
            const isDir = Object.keys(filesystem).some(k => k.startsWith(dirPrefix));

            if (isDir) {
                isValid = true; // valid as long as it has at least one child
                icon = FolderIcon(14);
                className = 'file-tag folder-tag';
            } else {
                isValid = filesystem[inj.value] !== undefined;
                icon = FileIcon(14);
                className = 'file-tag';
            }
        } else {
            isValid = !!assets.find(a => a.name === inj.value && a.type === inj.type);
            className = inj.type === 'system' ? 'system-tag' : 'skill-tag';
        }

        if (isValid) {
            const placeholder = `{{TAG_INJECTION_${idx}}}`;
            // Use just the trigger char so the chip label matches the editor chip display
            const triggerChar = inj.type === 'file' ? '@' : inj.type === 'skill' ? '/' : '#';
            const chipLabel = `${triggerChar}${inj.value}`;
            placeholders[placeholder] = `<span class="tag-highlight ${className}">${icon}${chipLabel}</span>`;
            contentWithPlaceholders = contentWithPlaceholders.split(inj.fullMatch).join(placeholder);
        }
    });

    let renderedHtml = renderMarkdown(contentWithPlaceholders);

    for (const [placeholder, replacement] of Object.entries(placeholders)) {
        renderedHtml = renderedHtml.split(placeholder).join(replacement);
    }

    return renderedHtml;
}
