import { BaseComponent } from '../BaseComponent';
import { StopIcon, ArrowRightIcon, CubeIcon, FileIcon, FolderIcon, CubeFilledIcon, Cube3dIcon } from './Icons';
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
  label: string;        // full path / logical name (used in chip + serialisation)
  displayName: string;  // short name shown in the popup row (basename)
  detail?: string;
  icon: string; // raw SVG
  triggerChar: string;
  isDirectory: boolean; // true = folder (navigate deeper); false = file (inserts mention)
}

// ── Directory helpers ─────────────────────────────────────────────────────────

/** True if `path` has children in the filesystem (i.e. is a directory). */
function isDirectory(path: string, filesystem: Record<string, string>): boolean {
  const prefix = path + '/';
  return Object.keys(filesystem).some(k => k.startsWith(prefix));
}

/**
 * Returns the immediate one-level children of `parentPath` in the filesystem.
 * Root is represented as '/'.
 */
function getDirectChildren(parentPath: string, filesystem: Record<string, string>): string[] {
  const allPaths = Object.keys(filesystem);
  if (parentPath === '/') {
    // Root: keep paths that have exactly one level (no '/' after the leading slash)
    return allPaths.filter(p => {
      if (p === '/') return false;
      return !p.substring(1).includes('/');
    });
  }
  const prefix = parentPath + '/';
  return allPaths.filter(p => {
    if (!p.startsWith(prefix)) return false;
    const rel = p.substring(prefix.length);
    return rel.length > 0 && !rel.includes('/');
  });
}

// ─── Suggestion item builders ────────────────────────────────────────────────

function buildSuggestionItems(
  query: string,
  triggerChar: '@' | '/' | '#',
  injections: AgentInjection[],
  filesystem: Record<string, string>
): SuggestionItem[] {
  const q = query.toLowerCase();

  if (triggerChar === '@') {
    // ── Tiered file / folder navigation ──────────────────────────────────────
    // Parse the query into a "current directory" and a basename filter.
    //   query = ""              →  dir = "/",         filter = ""
    //   query = "/.agents"      →  dir = "/",         filter = ".agents"
    //   query = "/.agents/"     →  dir = "/.agents",  filter = ""
    //   query = "/.agents/ski"  →  dir = "/.agents",  filter = "ski"
    let currentDir: string;
    let filter: string;
    const lastSlash = q.lastIndexOf('/');
    if (lastSlash <= 0) {
      currentDir = '/';
      filter = q;
    } else {
      // Preserve original case for path lookup; use lowercased for filter comparison
      currentDir = query.substring(0, lastSlash);
      filter = q.substring(lastSlash + 1);
    }

    const children = getDirectChildren(currentDir, filesystem)
      .filter(path => {
        const basename = path.substring(currentDir === '/' ? 1 : currentDir.length + 1);
        return basename.toLowerCase().includes(filter);
      })
      .slice(0, 12);

    return children.map(path => {
      const basename = path.substring(currentDir === '/' ? 1 : currentDir.length + 1);
      const isDir = isDirectory(path, filesystem);
      return {
        id: `file:${path}`,
        label: path,
        displayName: basename,
        detail: isDir ? 'Folder' : 'File',
        icon: isDir ? FolderIcon(14) : FileIcon(14),
        triggerChar: '@',
        isDirectory: isDir,
      };
    });
  }

  if (triggerChar === '/') {
    return injections
      .filter(s => s.type === 'skill' && s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(s => ({
        id: `skill:${s.name}`,
        label: s.name,
        displayName: s.name,
        detail: s.description || 'Skill',
        icon: CubeFilledIcon(14),
        triggerChar: '/',
        isDirectory: false,
      }));
  }

  if (triggerChar === '#') {
    return injections
      .filter(s => s.type === 'system' && s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(s => ({
        id: `system:${s.name}`,
        label: s.name,
        displayName: s.name,
        detail: s.description || 'System',
        icon: Cube3dIcon(14),
        triggerChar: '#',
        isDirectory: false,
      }));
  }

  return [];
}

// ─── Serialisation ────────────────────────────────────────────────────────────

/**
 * Converts a Tiptap JSON doc to a plain-text string that the PromptAssembler
 * can parse. Mention nodes are serialised as e.g. `@file:/path/to/file`.
 * Uses node *type* to determine the prefix — more reliable than reading a
 * stored mentionSuggestionChar attr which is not declared in addAttributes
 * and therefore never persisted in the ProseMirror node JSON.
 */
function serializeDoc(doc: any): string {
  if (!doc || !doc.content) return '';
  const parts: string[] = [];

  function walk(node: any) {
    if (node.type === 'text') {
      parts.push(node.text || '');
    } else if (node.type === 'mentionAt' || node.type === 'mention') {
      const label = node.attrs?.label || node.attrs?.id || '';
      parts.push(`@file:${label}`);
    } else if (node.type === 'mentionSlash') {
      const label = node.attrs?.label || node.attrs?.id || '';
      parts.push(`/skill:${label}`);
    } else if (node.type === 'mentionHash') {
      const label = node.attrs?.label || node.attrs?.id || '';
      parts.push(`#system:${label}`);
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

// ─── Renderer factory ─────────────────────────────────────────────────────────

interface Renderer {
  popup: HTMLElement | null;
  selectedIndex: number;
  items: SuggestionItem[];
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
  onUpdate: (props: any) => void;
  onStart: (props: any) => void;
  onExit: () => void;
}

/**
 * Creates an independent renderer instance (one per mention extension).
 * Each has its own local state: popup DOM, items list, selection index.
 */
function createRenderer(): Renderer {
  let popup: HTMLElement | null = null;
  let items: SuggestionItem[] = [];
  let selectedIndex = 0;
  let clientProps: any = null;

  /**
   * Folders navigate one level deeper; files insert a mention node.
   */
  function selectItem(item: SuggestionItem) {
    if (item.isDirectory) {
      const editor = clientProps?.editor;
      const range  = clientProps?.range;
      if (editor && range) {
        // Delete from the trigger '@' to the cursor, then re-insert with the
        // folder path appended — this re-triggers the suggestion with the new query.
        editor.chain()
          .focus()
          .deleteRange(range)
          .insertContent('@' + item.label + '/')
          .run();
      }
    } else {
      clientProps?.command(item);
    }
  }

  function renderPopup() {
    if (!popup || items.length === 0) {
      if (popup) popup.style.display = 'none';
      return;
    }
    popup.style.display = 'block';
    popup.innerHTML = `
      <div class="ti-suggestion-list agent-scrollbar">
        ${items.map((item, i) => `
          <div class="ti-suggestion-item ${i === selectedIndex ? 'ti-suggestion-item--active' : ''} ${item.isDirectory ? 'ti-suggestion-item--folder' : ''}" data-index="${i}">
            <span class="ti-suggestion-icon">${item.icon}</span>
            <span class="ti-suggestion-label">${item.displayName ?? item.label}</span>
            ${item.detail ? `<span class="ti-suggestion-detail ${item.isDirectory ? 'ti-suggestion-detail--folder' : ''}">${item.detail}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    popup.querySelectorAll('.ti-suggestion-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset.index || '0');
        selectedIndex = idx;
        selectItem(items[idx]);
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
      // Mount to .chat-input-group which has position:relative and no overflow:hidden
      const group = editorEl.closest('.chat-input-group') as HTMLElement | null;
      if (!group) return;

      popup = document.createElement('div');
      popup.className = 'ti-suggestion-popup';
      group.appendChild(popup);

      // Position popup just above the input container
      const container = group.querySelector('.chat-input-container') as HTMLElement | null;
      if (container && popup) {
        const groupRect = group.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const bottomOffset = groupRect.bottom - containerRect.top + 8;
        popup.style.bottom = `${bottomOffset}px`;
      }

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
          selectItem(items[selectedIndex]);
          return true;
        }
      }
      return false;
    }
  };
}

// ─── Suggestion factory ───────────────────────────────────────────────────────

/**
 * Creates a suggestion config for a specific trigger character.
 * Each extension gets its own config so `items()` always uses the correct
 * trigger without having to detect it from editor text (which fails for file
 * paths that contain '/').
 */
function createMentionSuggestion(
  triggerChar: '@' | '/' | '#',
  getInjections: () => AgentInjection[],
  getFilesystem: () => Record<string, string>
) {
  return {
    allowSpaces: false,
    startOfLine: false,
    items({ query }: { query: string }) {
      return buildSuggestionItems(query, triggerChar, getInjections(), getFilesystem());
    },
    render: createRenderer,
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
            <div id="tiptap-editor" class="ti-editor"></div>
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

    const getInjections = () => this.props.injections;
    const getFilesystem = () => this.props.filesystem || {};

    // Each extension gets its OWN suggestion config bound to its trigger char.
    // This avoids the bug where items() would detect '/' inside file paths and
    // return skills instead of files.
    const mentionExtensions = [
      // ── @ file/folder mentions ─────────────────────────────────────────────
      // Stores isDirectory so renderHTML can pick file-vs-folder icon even when
      // content is re-hydrated from stored JSON.
      Mention.extend({
        name: 'mentionAt',
        addAttributes() {
          return {
            ...this.parent?.(),
            isDirectory: {
              default: false,
              parseHTML: el => el.getAttribute('data-is-directory') === 'true',
              renderHTML: attrs => ({ 'data-is-directory': attrs.isDirectory ? 'true' : 'false' }),
            },
          };
        }
      }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const isDir = !!node.attrs.isDirectory;
          // ProseMirror's renderSpec accepts real DOM nodes as children.
          const iconEl = document.createElement('span');
          iconEl.className = 'ti-mention-icon';
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.innerHTML = isDir ? FolderIcon(14) : FileIcon(14);
          return ['span', {
            class: 'ti-mention ti-mention--file',
            'data-id': node.attrs.id,
            'data-label': label,
          }, iconEl, `@${label}`];
        },
        suggestion: { ...createMentionSuggestion('@', getInjections, getFilesystem), char: '@' }
      }),
      // ── / skill mentions ───────────────────────────────────────────────────
      Mention.extend({ name: 'mentionSlash' }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const iconEl = document.createElement('span');
          iconEl.className = 'ti-mention-icon';
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.innerHTML = CubeFilledIcon(14);
          return ['span', {
            class: 'ti-mention ti-mention--skill',
            'data-id': node.attrs.id,
            'data-label': label,
          }, iconEl, `/${label}`];
        },
        suggestion: { ...createMentionSuggestion('/', getInjections, getFilesystem), char: '/' }
      }),
      // ── # system mentions ──────────────────────────────────────────────────
      Mention.extend({ name: 'mentionHash' }).configure({
        HTMLAttributes: { class: 'ti-mention' },
        renderHTML({ node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          const iconEl = document.createElement('span');
          iconEl.className = 'ti-mention-icon';
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.innerHTML = Cube3dIcon(14);
          return ['span', {
            class: 'ti-mention ti-mention--system',
            'data-id': node.attrs.id,
            'data-label': label,
          }, iconEl, `#${label}`];
        },
        suggestion: { ...createMentionSuggestion('#', getInjections, getFilesystem), char: '#' }
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
          placeholder: this.props.placeholder || 'Ask anything, @ to mention files',
          emptyEditorClass: 'ti-editor-empty',
        }),
        ...mentionExtensions,
      ],
      editorProps: {
        attributes: {
          class: 'ti-prosemirror',
          spellcheck: 'false',
          'aria-label': this.props.placeholder || 'Ask anything, @ to mention files',
          'data-placeholder': this.props.placeholder || 'Ask anything, @ to mention files',
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
    this.updatePlaceholder();
  }

  private updatePlaceholder() {
    if (!this.editor) return;
    const text = this.props.placeholder || 'Ask anything, @ to mention files';
    const dom = this.editor.view.dom;
    if (dom.getAttribute('data-placeholder') !== text) {
      dom.setAttribute('data-placeholder', text);
      dom.setAttribute('aria-label', text);
    }
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
