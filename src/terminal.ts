import { Sandbox } from './Sandbox';

export interface TerminalOptions {
  sandbox: Sandbox;
  /** Automatically mount popup to document.body (defaults to true) */
  autoMount?: boolean;
}

/**
 * Minimalist, Apple-style black-and-white terminal popup using vanilla browser primitives.
 */
export class TerminalUI {
  private sandbox: Sandbox;
  private container: HTMLDivElement | null = null;
  private outputEl: HTMLPreElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private history: string[] = [];
  private historyIdx: number = -1;
  private isVisible: boolean = false;

  constructor(options: TerminalOptions) {
    this.sandbox = options.sandbox;
    if (typeof document !== 'undefined' && options.autoMount !== false) {
      this.mount();
    }
  }

  private triggerBtn: HTMLButtonElement | null = null;

  public mount() {
    if (this.container || typeof document === 'undefined') return;

    // Outer popup container
    const container = document.createElement('div');
    container.id = 'pugilister-terminal';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 540px;
      height: 360px;
      background: #ffffff;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      border-radius: 10px;
      border: 1px solid #e5e5e5;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      z-index: 99999;
      overflow: hidden;
    `;

    // Floating trigger button when closed
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'pugilister-terminal-trigger';
    triggerBtn.textContent = 'pugilister';
    triggerBtn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #ffffff;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #e5e5e5;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      z-index: 99998;
      display: none;
      user-select: none;
    `;
    triggerBtn.addEventListener('click', () => this.show());

    // Minimal Apple-style header bar: pugilister | clear | ✕
    const header = document.createElement('div');
    header.style.cssText = `
      background: #fafafa;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e5e5;
      user-select: none;
    `;
    header.innerHTML = `
      <span style="font-weight: 500; color: #111111; font-size: 12px; letter-spacing: -0.01em;">pugilister</span>
      <div style="display: flex; gap: 12px; align-items: center;">
        <button id="pugilister-term-clear" style="background:none;border:none;color:#666666;cursor:pointer;font-size:11px;padding:0;">clear</button>
        <button id="pugilister-term-close" style="background:none;border:none;color:#666666;cursor:pointer;font-size:13px;line-height:1;padding:0;">✕</button>
      </div>
    `;

    // Output text log area
    const output = document.createElement('pre');
    output.id = 'pugilister-terminal-output';
    output.style.cssText = `
      flex: 1;
      margin: 0;
      padding: 12px 14px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      color: #111111;
      line-height: 1.45;
      font-family: inherit;
    `;

    // Input prompt bar (no placeholder)
    const promptBar = document.createElement('div');
    promptBar.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 14px;
      background: #ffffff;
      border-top: 1px solid #e5e5e5;
    `;

    const promptSymbol = document.createElement('span');
    promptSymbol.style.cssText = 'color: #111111; font-weight: 600; margin-right: 8px;';
    promptSymbol.textContent = '$';

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #111111;
      font-family: inherit;
      font-size: 13px;
    `;

    promptBar.appendChild(promptSymbol);
    promptBar.appendChild(input);

    container.appendChild(header);
    container.appendChild(output);
    container.appendChild(promptBar);

    document.body.appendChild(container);
    document.body.appendChild(triggerBtn);

    this.container = container;
    this.triggerBtn = triggerBtn;
    this.outputEl = output;
    this.inputEl = input;
    this.isVisible = true;

    // Event handlers
    header.querySelector('#pugilister-term-close')?.addEventListener('click', () => this.hide());
    header.querySelector('#pugilister-term-clear')?.addEventListener('click', () => {
      if (this.outputEl) this.outputEl.textContent = '';
    });

    input.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        const currentVal = input.value;
        this.appendOutput(`$ ${currentVal}^C\n`, '#111111');
        input.value = '';
        this.historyIdx = this.history.length;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const currentVal = input.value;
        const result = await this.sandbox.getCompletions(currentVal);

        if (result.isSingleMatch) {
          input.value = result.completedLine;
        } else if (result.matches.length > 1) {
          if (result.completedLine !== currentVal) {
            input.value = result.completedLine;
          }
          this.appendOutput(`$ ${currentVal}\n`, '#111111');
          const formatted = result.matches.join('  ');
          this.appendOutput(`${formatted}\n`, '#666666');
        }
      } else if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        if (!cmd) return;

        this.history.push(cmd);
        this.historyIdx = this.history.length;

        this.appendOutput(`$ ${cmd}\n`, '#111111');
        const res = await this.sandbox.exec(cmd);
        if (res.stdout) this.appendOutput(res.stdout, '#111111');
        if (res.stderr) this.appendOutput(res.stderr, '#666666');
        if (!res.stdout && !res.stderr) {
          this.appendOutput(`(exit code ${res.exitCode})\n`, '#888888');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length > 0 && this.historyIdx > 0) {
          this.historyIdx--;
          input.value = this.history[this.historyIdx] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIdx < this.history.length - 1) {
          this.historyIdx++;
          input.value = this.history[this.historyIdx] || '';
        } else {
          this.historyIdx = this.history.length;
          input.value = '';
        }
      }
    });

    // Global toggle key (Ctrl+` or Cmd+`)
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public appendOutput(text: string, color = '#111111') {
    if (!this.outputEl) return;
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = text;
    this.outputEl.appendChild(span);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  public show() {
    if (this.container) {
      this.container.style.display = 'flex';
      if (this.triggerBtn) this.triggerBtn.style.display = 'none';
      this.isVisible = true;
      this.inputEl?.focus();
    }
  }

  public hide() {
    if (this.container) {
      this.container.style.display = 'none';
      if (this.triggerBtn) this.triggerBtn.style.display = 'block';
      this.isVisible = false;
    }
  }

  public toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }
}
