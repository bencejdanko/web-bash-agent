import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalLogic } from './TerminalLogic';
import { PersistentBashSandbox } from './PersistentBashSandbox';

export interface TerminalSession {
    id: string;
    terminal: Terminal;
    logic: TerminalLogic;
    serializeAddon: SerializeAddon;
    fitAddon: FitAddon;
    container?: HTMLElement;
    command?: string;
    output?: string;
}

export class TerminalSessionManager {
    private static instance: TerminalSessionManager | null = null;
    private sessions: Map<string, TerminalSession> = new Map();
    private sandbox: PersistentBashSandbox | null = null;
    private saveTimeout: any = null;
    private onStateChange?: () => void;

    private constructor() {}

    public static getInstance(): TerminalSessionManager {
        if (!TerminalSessionManager.instance) {
            TerminalSessionManager.instance = new TerminalSessionManager();
        }
        return TerminalSessionManager.instance;
    }

    public init(sandbox: PersistentBashSandbox, onStateChange?: () => void) {
        this.sandbox = sandbox;
        this.onStateChange = onStateChange;
    }

    public getOrCreateSession(id: string, options: { 
        command?: string, 
        initialOutput?: string, 
        initialHistory?: string[],
        initialState?: string, // ANSI serialized state
        onExit?: () => void
    }): TerminalSession {
        if (this.sessions.has(id)) {
            return this.sessions.get(id)!;
        }

        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            lineHeight: 1.2,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            theme: {
                background: '#ffffff',
                foreground: '#18181b',
                cursor: '#18181b',
                selectionBackground: 'rgba(24, 24, 27, 0.1)',
                black: '#18181b',
                red: '#ef4444',
                green: '#16a34a',
                yellow: '#ca8a04',
                blue: '#2563eb',
                magenta: '#9333ea',
                cyan: '#0891b2',
                white: '#ffffff',
            },
            convertEol: true,
            rows: 24,
            cols: 80
        });

        const serializeAddon = new SerializeAddon();
        const fitAddon = new FitAddon();
        terminal.loadAddon(serializeAddon);
        terminal.loadAddon(fitAddon);

        if (!this.sandbox) throw new Error('TerminalSessionManager not initialized');

        const logic = new TerminalLogic({
            terminal,
            sandbox: this.sandbox,
            onExit: options.onExit,
            history: options.initialHistory,
            onChange: () => this.scheduleSave()
        });

        const session: TerminalSession = {
            id,
            terminal,
            logic,
            serializeAddon,
            fitAddon,
            command: options.command,
            output: options.initialOutput
        };

        this.sessions.set(id, session);

        // Rehydrate state or initialize
        if (options.initialState) {
            terminal.write(options.initialState);
        } else {
            if (options.initialOutput) {
                 logic.writeCommandLine(options.command || 'bash');
                 logic.writeOutput(options.initialOutput);
                 if (!options.initialOutput.endsWith('\n')) terminal.write('\r\n');
                 logic.writePrompt();
            } else {
                 logic.writePrompt();
            }
        }

        terminal.onData(data => {
            logic.handleKey(data);
        });

        return session;
    }

    /**
     * Executes a command through a new or existing snapshot session.
     */
    public async runCommand(id: string, command: string): Promise<string> {
        if (!this.sandbox) throw new Error('TerminalSessionManager not initialized');
        
        const session = this.getOrCreateSession(id, { command });
        
        try {
            // Write the command line just like a user would
            session.logic.writeCommandLine(command);
            
            const result = await this.sandbox.exec(command);
            const output = (result.stdout || '') + (result.stderr || '') || '(no output)';
            
            // Update session state
            session.output = output;
            
            // Write the output and the next prompt
            session.logic.writeOutput(output);
            if (!output.endsWith('\n')) session.terminal.write('\r\n');
            session.logic.writePrompt();
            
            this.scheduleSave();
            return output;
        } catch (e: any) {
            const err = `Error: ${e.message || e}`;
            session.terminal.writeln(`\r\n\x1b[31m${err}\x1b[0m`);
            session.logic.writePrompt();
            return err;
        }
    }

    public mount(id: string, container: HTMLElement) {
        const session = this.sessions.get(id);
        if (!session) return;

        if (session.container === container) {
            session.fitAddon.fit();
            return;
        }

        session.container = container;
        session.terminal.open(container);
        
        // Ensure fit happens after opening and being in DOM
        requestAnimationFrame(() => {
            session.fitAddon.fit();
        });
    }

    public getSession(id: string): TerminalSession | undefined {
        return this.sessions.get(id);
    }

    public deleteSession(id: string) {
        const session = this.sessions.get(id);
        if (session) {
            session.terminal.dispose();
            this.sessions.delete(id);
            this.scheduleSave();
        }
    }

    public getAllSessionStates(): Record<string, { state: string, history: string[] }> {
        const states: Record<string, { state: string, history: string[] }> = {};
        for (const [id, session] of this.sessions.entries()) {
            states[id] = {
                state: session.serializeAddon.serialize(),
                history: session.logic.getHistory()
            };
        }
        return states;
    }

    private scheduleSave() {
        if (this.saveTimeout) return;
        this.saveTimeout = setTimeout(() => {
            this.saveTimeout = null;
            this.onStateChange?.();
        }, 2000); // 2 second throttle
    }

    public forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.onStateChange?.();
    }
}
