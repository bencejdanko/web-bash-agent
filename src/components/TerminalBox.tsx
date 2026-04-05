import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LiveTimer } from './LiveTimer';
import { ExternalLinkIcon } from './Icons';
import '@xterm/xterm/css/xterm.css';

interface TerminalBoxProps {
  command: string;
  output?: string;
  bashSandbox?: any;
  isPending?: boolean;
  startTime?: number;
  onOpenExternal?: () => void;
  isMinimal?: boolean;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({ 
  command, 
  output, 
  bashSandbox,
  isPending,
  startTime,
  onOpenExternal,
  isMinimal
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

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
      rows: 10,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const getPrompt = () => {
      return `\x1b[1;32m$\x1b[0m `;
    };


    // Initial sequence
    term.writeln(`\x1b[1;32m$\x1b[0m \x1b[1m${command}\x1b[0m`);
    
    // Add initial command to history if it's not a generic bash shell
    if (command && command !== 'bash' && !historyRef.current.includes(command)) {
      historyRef.current.push(command);
    }
    
    if (isPending) {
      term.write('\r\n\x1b[2mProcessing...\x1b[0m');
    } else if (output) {
      const outputLines = output.split('\n');
      outputLines.forEach((line, idx) => {
        const prefix = idx === outputLines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
        term.writeln(`${prefix} ${line}`);
      });
      term.write('\r\n' + getPrompt());
    } else {
      term.write('\r\n' + getPrompt());
    }

    let currentLine = '';
    let tempInput = '';

    const dataHandler = term.onData(data => {
      const code = data.charCodeAt(0);

      // Handle Up Arrow
      if (data === '\x1b[A') {
        if (historyRef.current.length > 0) {
          if (historyIndexRef.current === -1) {
            tempInput = currentLine;
            historyIndexRef.current = historyRef.current.length - 1;
          } else if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
          }
          
          // Clear current line
          for (let i = 0; i < currentLine.length; i++) {
            term.write('\b \b');
          }
          currentLine = historyRef.current[historyIndexRef.current];
          term.write(currentLine);
        }
        return;
      }

      // Handle Down Arrow
      if (data === '\x1b[B') {
        if (historyIndexRef.current !== -1) {
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            for (let i = 0; i < currentLine.length; i++) {
              term.write('\b \b');
            }
            currentLine = historyRef.current[historyIndexRef.current];
            term.write(currentLine);
          } else {
            historyIndexRef.current = -1;
            for (let i = 0; i < currentLine.length; i++) {
              term.write('\b \b');
            }
            currentLine = tempInput;
            term.write(currentLine);
          }
        }
        return;
      }
      
      if (code === 13) { // Enter
        term.write('\r\n');
        const cmdToRun = currentLine.trim();
        if (cmdToRun) {
           historyRef.current.push(cmdToRun);
           historyIndexRef.current = -1;
           tempInput = '';

           if (bashSandbox) {
             bashSandbox.exec(cmdToRun).then((res: any) => {
               if (res.stdout) term.write(res.stdout);
               if (res.stderr) term.write(`\x1b[31m${res.stderr}\x1b[0m`);
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
      } else {
        currentLine += data;
        term.write(data);
        // Reset history navigation if we start typing something new after browsing
        if (historyIndexRef.current !== -1) {
          historyIndexRef.current = -1;
          tempInput = '';
        }
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
  }, [mounted, bashSandbox, command, output, isPending]);

  if (!mounted) {
    return (
      <div className={`terminal-box ${isMinimal ? 'minimal' : ''} light`}>
        {!isMinimal && (
          <div className="terminal-header">
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <span>{isPending ? 'Running command...' : 'Ran command'}</span>
               {isPending && startTime && <LiveTimer startTime={startTime} />}
             </div>
             {onOpenExternal && (
               <button onClick={onOpenExternal} className="terminal-external-btn">
                 <span>Open in terminal</span>
                 <ExternalLinkIcon size={12} />
               </button>
             )}
          </div>
        )}
        <div style={{ padding: '0', height: '150px', background: '#ffffff' }} />
      </div>
    );
  }

  return (
    <div className={`terminal-box ${isMinimal ? 'minimal' : ''} light`}>
      {!isMinimal && (
        <div className="terminal-header" style={{ pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isPending ? 'Running command...' : 'Ran command'}</span>
            {isPending && startTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="streaming-indicator" style={{ background: '#71717a' }} />
                <LiveTimer startTime={startTime} />
              </div>
            )}
          </div>
          {onOpenExternal && (
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenExternal(); }} 
              className="terminal-external-btn"
              title="Open in standalone terminal"
              style={{ pointerEvents: 'auto' }}
            >
              <span>Relocate</span><ExternalLinkIcon size={12} />
            </button>
          )}
        </div>
      )}
      <div 
        ref={terminalRef} 
        className="xterm-container"
        style={{ 
          padding: isMinimal ? '4px 12px' : '12px', 
          backgroundColor: '#ffffff',
        }} 
      />
    </div>
  );
};
