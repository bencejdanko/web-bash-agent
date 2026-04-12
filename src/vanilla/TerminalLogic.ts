import { Terminal } from '@xterm/xterm';
import { PersistentBashSandbox } from './PersistentBashSandbox';

export interface TerminalLogicOptions {
    terminal: Terminal;
    sandbox: PersistentBashSandbox;
    onExit?: () => void;
    history?: string[];
    onHistoryChange?: (history: string[]) => void;
    onChange?: () => void;
}

export class TerminalLogic {
    private terminal: Terminal;
    private sandbox: PersistentBashSandbox;
    private inputBuffer = '';
    private cursorPosition = 0;
    private history: string[] = [];
    private historyIndex = -1;
    private isExecuting = false;
    private onExit?: () => void;
    private onChange?: () => void;

    constructor(options: TerminalLogicOptions) {
        this.terminal = options.terminal;
        this.sandbox = options.sandbox;
        this.onExit = options.onExit;
        this.history = options.history || [];
        this.onChange = options.onChange;
    }

    public async handleKey(data: string) {
        if (this.isExecuting) return;

        if (data === '\r') { // Enter
            this.terminal.write('\r\n');
            const command = this.inputBuffer;
            if (command.trim()) {
                this.history.push(command);
                this.onChange?.();
            }
            this.historyIndex = -1;
            this.inputBuffer = '';
            this.cursorPosition = 0;
            await this.executeManualCommand(command);
        } else if (data === '\x7f' || data === '\x08') { // Backspace
            const promptLen = this.getVisiblePromptLength();
            const cursorX = this.terminal.buffer.active.cursorX;
            
            if (this.cursorPosition > 0 && cursorX > promptLen) {
                const before = this.inputBuffer.slice(0, this.cursorPosition - 1);
                const after = this.inputBuffer.slice(this.cursorPosition);
                this.inputBuffer = before + after;
                this.cursorPosition--;
                
                // Visual update: move back and delete character at cursor
                this.terminal.write('\b\x1b[P');
            }
        } else if (data.startsWith('\x1b')) { // Escape sequences
            if (data === '\x1b[A') { // Arrow Up
                if (this.history.length > 0) {
                    if (this.historyIndex === -1) this.historyIndex = this.history.length - 1;
                    else if (this.historyIndex > 0) this.historyIndex--;
                    this.replaceInput(this.history[this.historyIndex]);
                }
            } else if (data === '\x1b[B') { // Arrow Down
                if (this.historyIndex !== -1) {
                    if (this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                        this.replaceInput(this.history[this.historyIndex]);
                    } else {
                        this.historyIndex = -1;
                        this.replaceInput('');
                    }
                }
            } else if (data === '\x1b[C') { // Arrow Right
                if (this.cursorPosition < this.inputBuffer.length) {
                    this.cursorPosition++;
                    this.terminal.write(data);
                }
            } else if (data === '\x1b[D') { // Arrow Left
                const promptLen = this.getVisiblePromptLength();
                if (this.cursorPosition > 0 && this.terminal.buffer.active.cursorX > promptLen) {
                    this.cursorPosition--;
                    this.terminal.write(data);
                }
            }
            return;
        } else if (data === '\t') { // Tab Completion
            const completions = await this.sandbox.getCompletions(this.inputBuffer);
            if (completions.length === 1) {
                const parts = this.inputBuffer.split(/\s+/);
                const lastPart = parts.pop() || '';
                const remaining = completions[0].slice(lastPart.length);
                this.terminal.write(remaining);
                this.inputBuffer += remaining;
                this.cursorPosition += remaining.length;
            } else if (completions.length > 1) {
                this.terminal.write('\r\n' + completions.join('  ') + '\r\n');
                this.terminal.write(this.getPrompt());
                this.restoreInput();
            }
        } else if (data === '\x03') { // Ctrl+C
            this.terminal.write('^C\r\n');
            this.inputBuffer = '';
            this.cursorPosition = 0;
            this.historyIndex = -1;
            this.writePrompt();
        } else { // Handle printable chars
            for (const char of data) {
                if (char.charCodeAt(0) >= 32) {
                    const before = this.inputBuffer.slice(0, this.cursorPosition);
                    const after = this.inputBuffer.slice(this.cursorPosition);
                    this.inputBuffer = before + char + after;
                    this.cursorPosition += char.length;
                    this.terminal.write(char + after);
                    for (let n = 0; n < after.length; n++) this.terminal.write('\b');
                }
            }
        }
    }

    private replaceInput(newInput: string) {
        // Clear current line
        for (let i = 0; i < this.cursorPosition; i++) this.terminal.write('\b');
        for (let i = 0; i < this.inputBuffer.length; i++) this.terminal.write(' ');
        for (let i = 0; i < this.inputBuffer.length; i++) this.terminal.write('\b');
        
        this.inputBuffer = newInput;
        this.cursorPosition = newInput.length;
        this.terminal.write(newInput);
    }

    public restoreInput() {
        if (!this.inputBuffer) return;
        this.terminal.write(this.inputBuffer);
        // Move cursor back to the stored position if it was not at the end
        const moveBack = this.inputBuffer.length - this.cursorPosition;
        for (let i = 0; i < moveBack; i++) {
            this.terminal.write('\x1b[D'); // Arrow Left
        }
    }

    private async executeManualCommand(command: string) {
        const cmd = command.trim();
        if (cmd === 'clear') {
            this.terminal.clear();
            this.writePrompt();
            return;
        }

        if (cmd === 'exit') {
            this.onExit?.();
            return;
        }

        this.isExecuting = true;
        try {
            const result = await this.sandbox.exec(command);
            if (result.stdout) this.writeOutput(result.stdout);
            if (result.stderr) this.writeOutput(result.stderr, true);
            if (result.stdout && !result.stdout.endsWith('\n')) this.terminal.write('\r\n');
        } catch (e: any) {
            this.writeOutput(`Error: ${e.message || e}`, true);
        }
        this.isExecuting = false;
        this.writePrompt();
        this.onChange?.();
    }

    public getPrompt() {
        const cwd = this.sandbox.getCwd() || '/site';
        const displayCwd = cwd === '/site' ? '~' : cwd.replace('/site', '~').replace(/\/$/, '');
        return `\x1b[32muser@agent\x1b[0m:\x1b[34m${displayCwd}\x1b[0m$ `;
    }

    private getVisiblePromptLength(): number {
        return this.getPrompt().replace(/\x1b\[[0-9;]*m/g, '').length;
    }

    public writePrompt() {
        this.terminal.write(this.getPrompt());
    }

    public writeOutput(text: string, isError = false) {
        const formatted = text.replace(/\n/g, '\r\n');
        this.terminal.write(isError ? `\x1b[31m${formatted}\x1b[0m` : formatted);
    }

    public writeCommandLine(command: string) {
        this.terminal.writeln(`${this.getPrompt().trim()} ${command}`);
    }

    public pressEnter() {
        this.handleKey('\r');
    }

    public getContent(): string {
        const buffer = this.terminal.buffer.active;
        let lines: string[] = [];
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) lines.push(line.translateToString(true));
        }
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }
        return lines.join('\n');
    }

    public getHistory(): string[] {
        return [...this.history];
    }
}
