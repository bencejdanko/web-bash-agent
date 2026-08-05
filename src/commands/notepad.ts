import { defineCommand } from 'just-bash/browser';
import { MinimalWindowModal } from './windowModal';

export interface NotepadOptions {
  filename: string;
  content: string;
  onSave: (text: string) => Promise<void>;
}

export class MinimalNotepadModal extends MinimalWindowModal {
  private textarea: HTMLTextAreaElement;

  constructor(options: NotepadOptions) {
    super({
      title: `Notepad - ${options.filename}`,
      statusText: `Editing: ${options.filename}`,
      width: 520,
      height: 380,
    });

    const saveBtn = this.createButton('Save', (e) => {
      e.preventDefault();
      doSave();
    });

    const closeBtn = this.createButton('Close', (e) => {
      e.preventDefault();
      this.close();
    });

    this.buttonGroup.appendChild(saveBtn);
    this.buttonGroup.appendChild(closeBtn);

    this.textarea = document.createElement('textarea');
    this.textarea.style.cssText = `
      flex: 1;
      width: 100%;
      height: 100%;
      border: none;
      padding: 10px;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.4;
      outline: none;
      resize: none;
      box-sizing: border-box;
      background: #ffffff;
      color: #000000;
    `;
    this.textarea.value = options.content;
    this.textarea.spellcheck = false;

    this.contentArea.appendChild(this.textarea);

    const doSave = async () => {
      try {
        await options.onSave(this.textarea.value);
        this.setStatus(`Saved ${options.filename} at ${new Date().toLocaleTimeString()}`);
      } catch (err: any) {
        this.setStatus(`Save error: ${err?.message || err}`);
      }
    };

    this.textarea.onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value = this.textarea.value.substring(0, start) + '    ' + this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
  }
}

/**
 * Reusable helper to open a file in a Notepad modal.
 */
export async function openNotepadModal(options: {
  filename: string;
  filePath: string;
  fs: any;
}) {
  const { filename, filePath, fs } = options;
  let fileContent = '';

  if (fs) {
    try {
      const raw = await fs.readFile(filePath);
      if (typeof raw === 'string') {
        fileContent = raw;
      } else if (raw instanceof Uint8Array || (raw && raw.constructor && raw.constructor.name === 'Uint8Array')) {
        fileContent = new TextDecoder().decode(raw);
      } else {
        fileContent = String(raw ?? '');
      }
    } catch {
      fileContent = '';
    }
  }

  if (typeof document !== 'undefined') {
    const modal = new MinimalNotepadModal({
      filename,
      content: fileContent,
      onSave: async (updatedContent: string) => {
        if (fs) {
          await fs.writeFile(filePath, updatedContent);
        }
      },
    });
    modal.show();
    return modal;
  }
  return null;
}

async function runNotepad(args: string[], ctx: any, context?: { getFs?: () => any }) {
  if (args.length === 0) {
    return {
      stdout: '',
      stderr: 'Usage: notepad <filename> or edit <filename>\n',
      exitCode: 1,
    };
  }

  try {
    const fs = (context?.getFs ? context.getFs() : null) || ctx.fs;
    const filename = args[0];
    const currentCwd = ctx.cwd || '/';
    const filePath = `${currentCwd}/${filename}`.replace(/\/+/g, '/');

    await openNotepadModal({ filename, filePath, fs });

    return {
      stdout: `\n`,
      stderr: '',
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `notepad error: ${err?.message || String(err)}\n`,
      exitCode: 1,
    };
  }
}

/**
 * Creates `notepad` command for draggable plain white browser-default popup window.
 */
export function createNotepadCommand(context?: { getFs?: () => any }) {
  return defineCommand('notepad', async (args, ctx) => {
    return await runNotepad(args, ctx, context);
  });
}

/**
 * Creates `edit` command alias for `notepad`.
 */
export function createEditCommand(context?: { getFs?: () => any }) {
  return defineCommand('edit', async (args, ctx) => {
    return await runNotepad(args, ctx, context);
  });
}
