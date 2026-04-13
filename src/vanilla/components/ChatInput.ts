import { BaseComponent } from '../BaseComponent';
import { StopIcon, ArrowRightIcon, CubeIcon, FileIcon, FolderIcon } from './Icons';
import { ModelConfig, AgentInjection } from '../../types';
import './ChatInput.css';

import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';

// Inline type to avoid importing @tiptap/suggestion separately
interface SuggestionKeyDownProps { event: KeyboardEvent; }

interface ChatInputProps {
  isProcessing: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  placeholder?: string;
  onOpenTerminal?: () => void;
  models: ModelConfig[];
  currentModelId: string;
  onModelChange: (id: string) => void;
  injections: AgentInjection[];
  filesystem?: Record<string, string>;
}

// ─── Suggestion data ─────────────────────────────────────────────────────────

interface SuggestionItem {
  id: string;
  label: string;
  detail?: string;
  icon: string; // raw SVG
  tagPrefix: string; // e.g. "@file:", "/skill:", "#system:"
  triggerChar: string;
}

function getFileIcon(path: string): string {
  if (path.endsWith('/')) return FolderIcon(14);
  return FileIcon(14);
}

function buildSuggestionItems(
  query: string,
  triggerChar: '@' | '/' | '#',
  injections: AgentInjection[],
  filesystem: Record<string, string>
): SuggestionItem[] {
  const q = query.toLowerCase();

  if (triggerChar === '@') {
    return Object.keys(filesystem)
      .filter(f => f.toLowerCase().includes(q))
      .slice(0, 10)
      .map(f => ({
        id: `file:${f}`,
        label: f,
        detail: 'File',
        icon: getFileIcon(f),
        tagPrefix: '@file:',
        triggerChar: '@'
      }));
  }

  if (triggerChar === '/') {
    return injections
      .filter(s => s.type === 'skill' && s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(s => ({
        id: `skill:${s.name}`,
        label: s.name,
        detail: s.description,
        icon: FileIcon(14),
        tagPrefix: '/skill:',
        triggerChar: '/'
      }));
  }

  if (triggerChar === '#') {
    return injections
      .filter(s => s.type === 'system' && s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(s => ({
        id: `system:${s.name}`,
        label: s.name,
        detail: s.description,
        icon: FileIcon(14),
        tagPrefix: '#system:',
        triggerChar: '#'
      }));
  }

  return [];
}

// ─── Serialisation ────────────────────────────────────────────────────────────

/**
 * Maps trigger char to the PromptAssembler tag prefix.
 */
const TRIGGER_TO_PREFIX: Record<string, string> = {
  '@': '@file:',
  '/': '/skill:',
  '#': '#system:'
};

/**
 * Converts a Tiptap JSON doc to a plain-text string that the PromptAssembler
 * can parse. Mention nodes are serialised as e.g. `@file:path/to/file`.
 */
function serializeDoc(doc: any): string {
  if (!doc || !doc.content) return '';
  const parts: string[] = [];

  function walk(node: any) {
    if (node.type === 'text') {
      parts.push(node.text || '');
    } else if (node.type === 'mention' ||
               node.type === 'mentionAt' ||
               node.type === 'mentionSlash' ||
               node.type === 'mentionHash') {
      const attr = node.attrs || {};
      const triggerChar = attr.mentionSuggestionChar || '@';
      const prefix = TRIGGER_TO_PREFIX[triggerChar] || `${triggerChar}file:`;
      const label = attr.label || attr.id || '';
      parts.push(`${prefix}${label}`);
    } else if (node.type === 'hardBreak') {
      parts.push('\n');
    } else if (node.type === 'paragraph') {
      if (node.content) node.content.forEach(walk);
      parts.push('\n');
    } else if (node.content) {
      node.content.forEach(walk);
    }
  }

  doc.content.forEach(walk);
  return parts.join('').replace(/\n+$/, '');
}

// ─── MentionSuggestion plugin ─────────────────────────────────────────────────

interface Renderer {
  popup: HTMLElement | null;
  selectedIndex: number;
  items: SuggestionItem[];
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
  onUpdate: (props: any) => void;
  onStart: (props: any) => void;
  onExit: () => void;
}

function createMentionSuggestion(
  getInjections: () => AgentInjection[],
  getFilesystem: () => Record<string, string>
) {
  return {
    allowSpaces: false,
    startOfLine: false,

    items({ query, editor }: { query: string; editor: Editor }) {
      const { selection } = editor.state;
      const { from } = selection;
      const textBefore = editor.state.doc.textBetween(0, from, '\n', '\0');

      let triggerChar: '@' | '/' | '#' = '@';
      for (let i = textBefore.length - 1; i >= 0; i--) {
        const ch = textBefore[i];
        if (ch === '@' || ch === '/' || ch === '#') {
          triggerChar = ch as '@' | '/' | '#';
          break;
        }
        if (ch === ' ' || ch === '\n') break;
      }

      return buildSuggestionItems(query, triggerChar, getInjections(), getFilesystem());
    },

    render(): Renderer {
      let popup: HTMLElement | null = null;
      let items: SuggestionItem[] = [];
      let selectedIndex = 0;
      let clientProps: any = null;

      function renderPopup() {
        if (!popup || items.length === 0) {
          if (popup) popup.style.display = 'none';
          return;
        }
        popup.style.display = 'block';
        popup.innerHTML = `
          <div class="ti-suggestion-list agent-scrollbar">
            ${items.map((item, i) => `
              <div class="ti-suggestion-item ${i === selectedIndex ? 'ti-suggestion-item--active' : ''}" data-index="${i}">
                <span class="ti-suggestion-icon">${item.icon}</span>
                <span class="ti-suggestion-label">${item.label}</span>
                ${item.detail ? `<span class="ti-suggestion-detail">${item.detail}</span>` : ''}
              </div>
            `).join('')}
          </div>
        `;

        popup.querySelectorAll('.ti-suggestion-item').forEach(el => {
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = parseInt((el as HTMLElement).dataset.index || '0');
            selectedIndex = idx;
            clientProps?.command(items[idx]);
          });
        });

        const active = popup.querySelector('.ti-suggestion-item--active') as HTMLElement | null;
        active?.scrollIntoView({ block: 'nearest' });
      }

      return {
        popup,
        items,
        selectedIndex,

        onStart(props: any) {
          clientProps = props;
          items = props.items;
          selectedIndex = 0;

          const editorEl = props.editor.view.dom as HTMLElement;
          const wrapper = editorEl.closest('.ti-editor-wrapper') as HTMLElement | null;
          if (!wrapper) return;

          popup = document.createElement('div');
          popup.className = 'ti-suggestion-popup';
          wrapper.appendChild(popup);
          renderPopup();
        },

        onUpdate(props: any) {
          clientProps = props;
          items = props.items;
          if (selectedIndex >= items.length) selectedIndex = 0;
          renderPopup();
        },

        onExit() {
          popup?.remove();
          popup = null;
        },

        onKeyDown({ event }: SuggestionKeyDownProps) {
          if (event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
            renderPopup();
            return true;
          }
          if (event.key === 'ArrowUp') {
            selectedIndex = (selectedIndex - 1 + items.length) % Math.max(items.length, 1);
            renderPopup();
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            if (items[selectedIndex]) {
              clientProps?.command(items[selectedIndex]);
              return true;
            }
          }
          return false;
        }
      };
    }
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export class ChatInput extends BaseComponent<ChatInputProps> {
  private editor: Editor | null = null;
  private isModelMenuOpen: boolean = false;
  private selectedModelIndex: number = 0;

  protected createRootElement(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'chat-input-wrapper';
    return div;
  }

  init() {
    this.renderShell();
    this.setupEditor();
    this.setupStaticListeners();
    this.updateDynamicParts();
  }

  render() {
    this.updateDynamicParts();
  }

  // ── Shell ──────────────────────────────────────────────────────────────────

  private renderShell() {
    const currentModel =
      this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];

    this.element.innerHTML = `
      <div class="chat-input-inner-wrapper chat-input-group">
        <div id="model-menu" class="model-menu-popup"></div>

        <div class="chat-input-container">
          <div class="ti-editor-wrapper">
            <div id="tiptap-editor" class="ti-editor" aria-label="${this.props.placeholder || 'Ask anything…'}"></div>
          </div>
          <div id="input-controls" class="input-controls-group"></div>
        </div>

        <div class="footer-controls-group">
          <div style="position: relative">
            <button id="btn-model-selector" class="control-btn-secondary">
              <div class="model-dot" style="background-color: var(--agent-accent)"></div>
              <span id="current-model-name">${currentModel?.name || 'Select Model'}</span>
              <code class="terminal-shortcut-hint">[CTRL+SHIFT+M]</code>
            </button>
          </div>

          ${this.props.onOpenTerminal ? `
            <button id="btn-open-terminal" class="control-btn-secondary">
              ${CubeIcon(14)}
              <span>Open terminal</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ── Tiptap editor ──────────────────────────────────────────────────────────

  private setupEditor() {
    const editorEl = this.query<HTMLElement>('#tiptap-editor')!;

    const suggestion = createMentionSuggestion(
      () => this.props.injections,
      () => this.props.filesystem || {}
    );

    const mentionExtensions = [
      Mention.extend({ name: 'mentionAt' }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const tChar = node.attrs.mentionSuggestionChar || '@';
          return ['span', {
            class: 'ti-mention',
            'data-id': node.attrs.id,
            'data-label': label,
            'data-mention-suggestion-char': tChar
          }, `${tChar}${label}`];
        },
        suggestion: { ...suggestion, char: '@' }
      }),
      Mention.extend({ name: 'mentionSlash' }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const tChar = node.attrs.mentionSuggestionChar || '/';
          return ['span', {
            class: 'ti-mention',
            'data-id': node.attrs.id,
            'data-label': label,
            'data-mention-suggestion-char': tChar
          }, `${tChar}${label}`];
        },
        suggestion: { ...suggestion, char: '/' }
      }),
      Mention.extend({ name: 'mentionHash' }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const tChar = node.attrs.mentionSuggestionChar || '#';
          return ['span', {
            class: 'ti-mention',
            'data-id': node.attrs.id,
            'data-label': label,
            'data-mention-suggestion-char': tChar
          }, `${tChar}${label}`];
        },
        suggestion: { ...suggestion, char: '#' }
      }),
    ];

    this.editor = new Editor({
      element: editorEl,
      extensions: [
        Document,
        Paragraph,
        Text,
        HardBreak,
        History,
        Placeholder.configure({
          placeholder: this.props.placeholder || 'Ask anything, @ for files, / for skills, # for system',
          emptyEditorClass: 'ti-editor-empty',
        }),
        ...mentionExtensions,
      ],
      editorProps: {
        attributes: {
          class: 'ti-prosemirror',
          spellcheck: 'false',
        },
      },
      onUpdate: () => {
        this.updateSendButton();
      },
    });

    // Intercept Enter to submit (Shift+Enter = newline via HardBreak)
    this.editor.view.dom.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const hasSuggestion = !!(this.element.querySelector('.ti-suggestion-popup'));
        if (!hasSuggestion) {
          e.preventDefault();
          this.handleSend();
        }
      }
    }, true);
  }

  // ── Dynamic parts ──────────────────────────────────────────────────────────

  private updateDynamicParts() {
    this.updateInputState();
    this.updateSendButton();
    this.updateModelMenu();
  }

  private updateInputState() {
    if (!this.editor) return;
    const editable = !this.props.isProcessing;
    if (this.editor.isEditable !== editable) {
      this.editor.setEditable(editable);
    }
  }

  private updateSendButton() {
    const controls = this.query<HTMLElement>('#input-controls');
    if (!controls) return;

    const isEmpty = !this.editor || this.editor.isEmpty;

    controls.innerHTML = `
      ${this.props.isProcessing ? `
        <button id="btn-cancel" class="btn-cancel-action" title="Cancel processing">${StopIcon()}</button>
      ` : ''}
      <button id="btn-send" class="btn-send-action ${(!isEmpty && !this.props.isProcessing) ? 'active' : ''}"
        ${isEmpty || this.props.isProcessing ? 'disabled' : ''}>${ArrowRightIcon()}</button>
    `;

    this.query<HTMLButtonElement>('#btn-send')?.addEventListener('click', () => this.handleSend());
    this.query<HTMLButtonElement>('#btn-cancel')?.addEventListener('click', () => this.props.onCancel());
  }

  private updateModelMenu() {
    const modelName = this.query<HTMLElement>('#current-model-name');
    const modelMenu = this.query<HTMLElement>('#model-menu')!;
    if (!modelMenu) return;

    const currentModel =
      this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];
    if (modelName) modelName.textContent = currentModel?.name || 'Select Model';

    if (!this.isModelMenuOpen) {
      modelMenu.style.display = 'none';
      return;
    }

    modelMenu.style.display = 'block';
    modelMenu.innerHTML = `
      <div class="model-options-list">
        ${this.props.models.map((m, i) => `
          <div class="model-option ${i === this.selectedModelIndex ? 'focused' : ''}"
            data-id="${m.id}" data-index="${i}"
            style="color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'var(--agent-text-main)'}">
            <div class="model-dot" style="background-color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'var(--agent-text-muted)'}"></div>
            <span style="font-weight: ${m.id === this.props.currentModelId ? '600' : 'normal'}">${m.name}</span>
          </div>
        `).join('')}
      </div>
    `;

    modelMenu.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.id!;
        this.props.onModelChange(id);
        this.isModelMenuOpen = false;
        this.updateModelMenu();
      });
    });
  }

  // ── Static listeners ───────────────────────────────────────────────────────

  private setupStaticListeners() {
    this.query<HTMLButtonElement>('#btn-model-selector')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isModelMenuOpen = !this.isModelMenuOpen;
      if (this.isModelMenuOpen) {
        this.selectedModelIndex =
          this.props.models.findIndex(m => m.id === this.props.currentModelId);
        if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
      }
      this.updateModelMenu();
    });

    this.query<HTMLButtonElement>('#btn-open-terminal')?.addEventListener('click', () =>
      this.props.onOpenTerminal?.()
    );

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        this.isModelMenuOpen = !this.isModelMenuOpen;
        if (this.isModelMenuOpen) {
          this.selectedModelIndex =
            this.props.models.findIndex(m => m.id === this.props.currentModelId);
          if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
          this.focus();
        }
        this.updateModelMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isModelMenuOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedModelIndex =
          (this.selectedModelIndex + 1) % this.props.models.length;
        this.updateModelMenu();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedModelIndex =
          (this.selectedModelIndex - 1 + this.props.models.length) % this.props.models.length;
        this.updateModelMenu();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const m = this.props.models[this.selectedModelIndex];
        if (m) {
          this.props.onModelChange(m.id);
          this.isModelMenuOpen = false;
          this.updateModelMenu();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.isModelMenuOpen = false;
        this.updateModelMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target as Node)) {
        if (this.isModelMenuOpen) {
          this.isModelMenuOpen = false;
          this.updateModelMenu();
        }
      }
    });
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  private handleSend() {
    if (!this.editor || this.editor.isEmpty || this.props.isProcessing) return;
    const doc = this.editor.getJSON();
    const text = serializeDoc(doc);
    if (!text.trim()) return;
    this.props.onSend(text);
    this.editor.commands.clearContent(true);
    this.updateSendButton();
  }

  // ── Focus ──────────────────────────────────────────────────────────────────

  focus() {
    requestAnimationFrame(() => {
      this.editor?.commands.focus();
    });
  }

  // ── Destroy ────────────────────────────────────────────────────────────────

  destroy() {
    this.editor?.destroy();
    this.editor = null;
  }
}
