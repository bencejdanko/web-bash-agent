import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { Sandbox } from './Sandbox';

export interface MountTerminalOptions {
  /** The Sandbox instance to connect to this terminal */
  sandbox: Sandbox;
  /** Welcome message displayed when the terminal loads */
  welcomeMessage?: string;
  /** Custom prompt string (defaults to "% ") */
  prompt?: string;
  /** Custom theme colors for xterm */
  theme?: ITerminalOptions['theme'];
  /** Font size in px (default 13) */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Fixed number of terminal rows */
  rows?: number;
}

function ensureXtermCss() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[data-xterm-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.setAttribute('data-xterm-css', 'true');
    css.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.css';
    document.head.appendChild(css);
  }
}

export class XTermTerminalUI {
  public term: Terminal;
  public fitAddon: FitAddon;
  private sandbox: Sandbox;
  private prompt: string;
  private welcomeMessage?: string;
  private lineBuffer: string = '';
  private cursorCol: number = 0;
  private history: string[] = [];
  private historyIdx: number = 0;
  private busy: boolean = false;
  private resizeHandler: () => void;

  constructor(container: HTMLElement, options: MountTerminalOptions) {
    ensureXtermCss();

    this.sandbox = options.sandbox;
    this.welcomeMessage = options.welcomeMessage;
    this.prompt = options.prompt ?? '% ';

    const defaultTheme: ITerminalOptions['theme'] = {
      background: '#ffffff',
      foreground: '#1d1d1f',
      cursor: '#1d1d1f',
      cursorAccent: '#ffffff',
      selectionBackground: '#d2d2d7',
      black: '#1d1d1f',
      red: '#c0392b',
      green: '#1a7f37',
      yellow: '#856404',
      blue: '#0066cc',
      magenta: '#6f42c1',
      cyan: '#0e7490',
      white: '#6e6e73',
      brightBlack: '#6e6e73',
      brightRed: '#c0392b',
      brightGreen: '#1a7f37',
      brightYellow: '#856404',
      brightBlue: '#0066cc',
      brightMagenta: '#6f42c1',
      brightCyan: '#0e7490',
      brightWhite: '#1d1d1f',
    };

    this.term = new Terminal({
      theme: options.theme ?? defaultTheme,
      fontFamily:
        options.fontFamily ??
        '"SF Mono", "Menlo", "Monaco", "Cascadia Mono", ui-monospace, monospace',
      fontSize: options.fontSize ?? 13,
      lineHeight: 1.4,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: 'block',
      allowProposedApi: true,
      scrollback: 5000,
      ...(options.rows ? { rows: options.rows } : {}),
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(container);

    this.fitTerminal();

    this.resizeHandler = () => this.fitTerminal();
    window.addEventListener('resize', this.resizeHandler);

    // Custom Key Event Handler for copy/paste
    this.term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === 'keydown') {
        // Ctrl+C or Cmd+C when text is selected -> let browser copy
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c' && this.term.hasSelection()) {
          return false;
        }
        // Ctrl+V or Cmd+V -> paste into line
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') {
          navigator.clipboard.readText().then((text) => {
            if (!text) return;
            const cleaned = text.replace(/[\r\n]+/g, ' ');
            const before = this.lineBuffer.slice(0, this.cursorCol);
            const after = this.lineBuffer.slice(this.cursorCol);
            this.lineBuffer = before + cleaned + after;
            this.cursorCol += cleaned.length;
            this.term.write(cleaned + after);
            if (after.length > 0) this.term.write('\x1b[' + after.length + 'D');
          });
          return false;
        }
      }
      return true;
    });

    if (options.welcomeMessage) {
      this.term.writeln(options.welcomeMessage);
    }
    this.writePrompt();

    this.initDataHandler();
    this.term.focus();
  }

  public fitTerminal() {
    this.fitAddon.fit();
  }

  private writePrompt() {
    this.term.write(this.prompt);
  }

  private clearLine() {
    if (this.cursorCol < this.lineBuffer.length) {
      this.term.write('\x1b[' + (this.lineBuffer.length - this.cursorCol) + 'C');
    }
    for (let i = 0; i < this.lineBuffer.length; i++) this.term.write('\b \b');
    this.lineBuffer = '';
    this.cursorCol = 0;
  }

  private redrawLine(newLine: string, newCursor: number) {
    this.clearLine();
    this.term.write(newLine);
    this.lineBuffer = newLine;
    this.cursorCol = newLine.length;
    if (newCursor < this.cursorCol) {
      const back = this.cursorCol - newCursor;
      this.term.write('\x1b[' + back + 'D');
      this.cursorCol = newCursor;
    }
  }

  private initDataHandler() {
    this.term.onData(async (data) => {
      // Ctrl+C: interrupt
      if (data === '\x03') {
        this.term.write('^C');
        this.busy = false;
        this.lineBuffer = '';
        this.cursorCol = 0;
        this.term.write('\r\n');
        this.writePrompt();
        return;
      }

      if (this.busy) return;

      // Enter
      if (data === '\r') {
        const cmd = this.lineBuffer.trim();
        this.lineBuffer = '';
        this.cursorCol = 0;
        this.term.write('\r\n');

        if (!cmd) {
          this.writePrompt();
          return;
        }

        if (this.history.length === 0 || this.history[this.history.length - 1] !== cmd) {
          this.history.push(cmd);
        }
        this.historyIdx = this.history.length;

        if ((cmd === 'motd' || cmd === 'welcome') && this.welcomeMessage) {
          this.showWelcome();
          this.writePrompt();
          return;
        }

        this.busy = true;
        let streamedChars = 0;
        const unsubscribe = this.sandbox.onStdout((text) => {
          streamedChars += text.length;
          this.term.write(text.replace(/\n/g, '\r\n'));
        });

        try {
          const res = await this.sandbox.exec(cmd);
          let printedText = '';
          if (res.stdout && streamedChars === 0) {
            this.term.write(res.stdout.replace(/\n/g, '\r\n'));
            printedText += res.stdout;
          }
          if (res.stderr) {
            this.term.write(
              '\x1b[38;5;203m' + res.stderr.replace(/\n/g, '\r\n') + '\x1b[0m'
            );
            printedText += res.stderr;
          }
          if (!res.stdout && !res.stderr && res.exitCode !== 0) {
            const exitMsg = '(exit ' + res.exitCode + ')\r\n';
            this.term.write('\x1b[38;5;244m' + exitMsg + '\x1b[0m');
            printedText += exitMsg;
          }
          if (
            printedText &&
            !printedText.endsWith('\n') &&
            !printedText.endsWith('\r') &&
            !printedText.includes('\x1b[2J') &&
            !printedText.includes('\x1b[H')
          ) {
            this.term.write('\r\n');
          }
        } catch (err) {
          this.term.write('\x1b[38;5;203mError: ' + String(err) + '\r\n\x1b[0m');
        } finally {
          unsubscribe();
          this.busy = false;
          this.writePrompt();
        }
        return;
      }

      // Backspace
      if (data === '\x7f') {
        if (this.cursorCol > 0) {
          const before = this.lineBuffer.slice(0, this.cursorCol - 1);
          const after = this.lineBuffer.slice(this.cursorCol);
          this.lineBuffer = before + after;
          this.cursorCol--;
          this.term.write('\b' + after + ' ');
          const back = after.length + 1;
          if (back > 0) this.term.write('\x1b[' + back + 'D');
        }
        return;
      }

      // Tab
      if (data === '\t') {
        const result = await this.sandbox.getCompletions(this.lineBuffer);
        if (result.isSingleMatch) {
          const newLine = result.completedLine;
          this.clearLine();
          this.term.write(newLine);
          this.lineBuffer = newLine;
          this.cursorCol = newLine.length;
        } else if (result.matches.length > 1) {
          if (result.completedLine !== this.lineBuffer) {
            this.clearLine();
            this.term.write(result.completedLine);
            this.lineBuffer = result.completedLine;
            this.cursorCol = result.completedLine.length;
          }
          this.term.write(
            '\r\n\x1b[38;5;244m' + result.matches.join('  ') + '\x1b[0m\r\n'
          );
          this.writePrompt();
          this.term.write(this.lineBuffer);
          this.cursorCol = this.lineBuffer.length;
        }
        return;
      }

      // Escape sequences
      if (data.startsWith('\x1b[') || data.startsWith('\x1b')) {
        if (data === '\x1b[A') {
          if (this.historyIdx > 0) {
            this.historyIdx--;
            const h = this.history[this.historyIdx] || '';
            this.redrawLine(h, h.length);
          }
          return;
        }
        if (data === '\x1b[B') {
          if (this.historyIdx < this.history.length - 1) {
            this.historyIdx++;
            const h = this.history[this.historyIdx] || '';
            this.redrawLine(h, h.length);
          } else {
            this.historyIdx = this.history.length;
            this.redrawLine('', 0);
          }
          return;
        }
        if (data === '\x1b[D') {
          if (this.cursorCol > 0) {
            this.cursorCol--;
            this.term.write('\x1b[D');
          }
          return;
        }
        if (data === '\x1b[C') {
          if (this.cursorCol < this.lineBuffer.length) {
            this.cursorCol++;
            this.term.write('\x1b[C');
          }
          return;
        }
        if (data === '\x1b[H') {
          if (this.cursorCol > 0) {
            this.term.write('\x1b[' + this.cursorCol + 'D');
            this.cursorCol = 0;
          }
          return;
        }
        if (data === '\x1b[F') {
          if (this.cursorCol < this.lineBuffer.length) {
            this.term.write('\x1b[' + (this.lineBuffer.length - this.cursorCol) + 'C');
            this.cursorCol = this.lineBuffer.length;
          }
          return;
        }
        return;
      }

      // Ctrl+A — start of line
      if (data === '\x01') {
        if (this.cursorCol > 0) {
          this.term.write('\x1b[' + this.cursorCol + 'D');
          this.cursorCol = 0;
        }
        return;
      }
      // Ctrl+E — end of line
      if (data === '\x05') {
        if (this.cursorCol < this.lineBuffer.length) {
          this.term.write('\x1b[' + (this.lineBuffer.length - this.cursorCol) + 'C');
          this.cursorCol = this.lineBuffer.length;
        }
        return;
      }
      // Ctrl+U — kill to start
      if (data === '\x15') {
        if (this.cursorCol > 0) {
          const after = this.lineBuffer.slice(this.cursorCol);
          this.term.write(
            '\x1b[' + this.cursorCol + 'D' + after + ' '.repeat(this.cursorCol)
          );
          this.term.write('\x1b[' + (after.length + this.cursorCol) + 'D');
          this.lineBuffer = after;
          this.cursorCol = 0;
        }
        return;
      }
      // Ctrl+K — kill to end
      if (data === '\x0b') {
        if (this.cursorCol < this.lineBuffer.length) {
          const toErase = this.lineBuffer.length - this.cursorCol;
          this.term.write(' '.repeat(toErase) + '\x1b[' + toErase + 'D');
          this.lineBuffer = this.lineBuffer.slice(0, this.cursorCol);
        }
        return;
      }
      // Ctrl+L — clear
      if (data === '\x0c') {
        this.term.write('\x1b[2J\x1b[H');
        this.term.clear();
        this.writePrompt();
        this.term.write(this.lineBuffer);
        this.cursorCol = this.lineBuffer.length;
        return;
      }

      // Printable — insert at cursor
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        const before = this.lineBuffer.slice(0, this.cursorCol);
        const after = this.lineBuffer.slice(this.cursorCol);
        this.lineBuffer = before + data + after;
        this.cursorCol++;
        this.term.write(data + after);
        if (after.length > 0) this.term.write('\x1b[' + after.length + 'D');
      }
    });
  }

  public showWelcome() {
    if (this.welcomeMessage) {
      this.term.writeln(this.welcomeMessage);
    }
  }

  public destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    this.term.dispose();
  }
}

/**
 * Mounts a full-featured xterm.js terminal onto a DOM element connected to a Pugilister sandbox.
 */
export function mountTerminal(
  container: HTMLElement | string,
  options: MountTerminalOptions
): XTermTerminalUI {
  const el =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;
  if (!el) {
    throw new Error(`[pugilister] Could not find container element: "${container}"`);
  }
  return new XTermTerminalUI(el, options);
}
