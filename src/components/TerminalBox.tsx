import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalBoxProps {
  command: string;
  output?: string;
  bashSandbox?: any;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({ command, output, bashSandbox }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      lineHeight: 1.2,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#18181b',
        foreground: '#f4f4f5',
        cursor: '#f4f4f5',
        selectionBackground: 'rgba(244, 244, 245, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#f4f4f5',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
      },
      convertEol: true,
      rows: 10,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const getPrompt = () => {
      const cwd = bashSandbox?.getCwd?.() || '/site';
      const folder = cwd.split('/').pop() || '/';
      return `\x1b[1;34m${folder}\x1b[0m \x1b[1;32m$\x1b[0m `;
    };

    // Initial sequence
    term.writeln(`\x1b[1;32m$\x1b[0m \x1b[1m${command}\x1b[0m`);
    if (output) {
      const outputLines = output.split('\n');
      outputLines.forEach((line, idx) => {
        const prefix = idx === outputLines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
        term.writeln(`${prefix} ${line}`);
      });
    }
    
    term.write('\r\n' + getPrompt());

    let currentLine = '';

    const dataHandler = term.onData(data => {
      const code = data.charCodeAt(0);
      
      if (code === 13) { // Enter
        term.write('\r\n');
        const cmdToRun = currentLine.trim();
        if (cmdToRun) {
           if (bashSandbox) {
             bashSandbox.exec(cmdToRun).then((res: any) => {
               if (res.stdout) term.write(res.stdout);
               if (res.stderr) term.write(`\x1b[31m${res.stderr}\x1b[0m`);
               if (!res.stdout && !res.stderr && res.exitCode === 0) {
                 // Success but no output
               }
               term.write('\r\n' + getPrompt());
             }).catch((err: any) => {
               term.write(`\x1b[31mError: ${err}\x1b[0m\r\n`);
               term.write(getPrompt());
             });
           } else {
             term.write('\x1b[31mbash: sandbox not available\x1b[0m\r\n');
             term.write(getPrompt());
           }
        } else {
           term.write(getPrompt());
        }
        currentLine = '';
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code < 32) {
        // Handle basic control chars if needed
      } else {
        currentLine += data;
        term.write(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch (e) {}
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      dataHandler.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [mounted, bashSandbox, command, output]);

  if (!mounted) {
    return (
      <div className="terminal-box">
        <div className="terminal-header">
           <span>Ran command</span>
        </div>
        <div style={{ padding: '10px', height: '150px', background: '#18181b' }} />
      </div>
    );
  }

  return (
    <div className="terminal-box">
      <div className="terminal-header">
        <span>Ran command</span>
      </div>
      <div 
        ref={terminalRef} 
        className="xterm-container"
        style={{ 
          padding: '10px', 
          backgroundColor: '#18181b',
        }} 
      />
    </div>
  );
};
