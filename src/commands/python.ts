import { defineCommand } from 'just-bash/browser';

let pyodideInstance: any = null;

async function getPyodide(): Promise<any> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (typeof window !== 'undefined' && typeof (window as any).loadPyodide === 'function') {
    pyodideInstance = await (window as any).loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
    });
    return pyodideInstance;
  }

  if (typeof document !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pyodide runtime script from CDN.'));
      document.head.appendChild(script);
    });

    if (typeof (window as any).loadPyodide === 'function') {
      pyodideInstance = await (window as any).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
      });
      return pyodideInstance;
    }
  }

  throw new Error('Pyodide script loaded but window.loadPyodide is unavailable.');
}

function cleanPythonError(err: any): string {
  const msg = err?.message || String(err);
  // Strip internal pyodide async runner stack traces for clean output
  const lines = msg.split('\n');
  const filtered = lines.filter(
    (line: string) =>
      !line.includes('_pyodide/_base.py') &&
      !line.includes('eval_code_async') &&
      !line.includes('CodeRunner(') &&
      !line.includes('coroutine = eval')
  );
  return filtered.join('\n');
}

/**
 * Creates a just-bash custom command for `python` / `python3` with bi-directional VFS sync
 * and an interactive `>>> ` REPL mode when launched without arguments.
 */
export function createPythonCommand(context?: { getFs?: () => any; getSandbox?: () => any; setSubshell?: any }) {
  return defineCommand('python', async (args, ctx) => {
    try {
      const pyodide = await getPyodide();
      const fs = (context?.getFs ? context.getFs() : null) || ctx.fs;

      const getSandbox = () => {
        if (context?.getSandbox) return context.getSandbox();
        if (typeof window !== 'undefined' && (window as any).terminalSessionManager?.sandbox) {
          return (window as any).terminalSessionManager.sandbox;
        }
        return null;
      };

      const sandbox = getSandbox();

      // INTERACTIVE REPL MODE (when python is run with 0 args)
      if (args.length === 0) {
        if (sandbox && typeof sandbox.setSubshell === 'function') {
          sandbox.setSubshell(
            async (inputLine: string) => {
              const trimmed = inputLine.trim();

              // Exit subshell REPL condition
              if (trimmed === 'exit()' || trimmed === 'quit()' || trimmed === 'exit' || trimmed === 'quit') {
                sandbox.setSubshell(null);
                return {
                  stdout: '\n',
                  stderr: '',
                  exitCode: 0,
                };
              }

              if (trimmed === '') {
                return { stdout: '', stderr: '', exitCode: 0 };
              }

              let stdout = '';
              let stderr = '';

              pyodide.setStdout({
                write: (buf: Uint8Array) => {
                  stdout += new TextDecoder().decode(buf);
                  return buf.length; // Crucial: return byte count so Emscripten write() succeeds
                },
              });
              pyodide.setStderr({
                write: (buf: Uint8Array) => {
                  stderr += new TextDecoder().decode(buf);
                  return buf.length; // Crucial: return byte count so Emscripten write() succeeds
                },
              });

              try {
                const result = await pyodide.runPythonAsync(inputLine);
                if (result !== undefined && result !== null && stdout === '') {
                  try {
                    const strVal = typeof result === 'object' && result?.toString ? result.toString() : String(result);
                    if (strVal !== '[object Object]' && strVal !== 'None') {
                      stdout = `${strVal}\n`;
                    }
                  } catch {
                    // Ignore string conversion errors
                  }
                }
                return { stdout, stderr, exitCode: 0 };
              } catch (err: any) {
                return { stdout: '', stderr: cleanPythonError(err), exitCode: 1 };
              }
            },
            () => '\x1b[33m>>> \x1b[0m' // Yellow >>> prompt
          );

          return {
            stdout: [
              'Python 3.12.0 (Pyodide WebAssembly REPL)',
              'Type "help", "copyright", "credits" or "license" for more information.',
              'Type exit() or quit() to return to bash.',
            ].join('\n') + '\n',
            stderr: '',
            exitCode: 0,
          };
        }

        return {
          stdout: [
            'Python 3.12.0 (Pyodide WebAssembly Engine)',
            'Type "python -c <expr>" or "python <script.py>" to execute code.',
            'Global Python variables and state persist statefully across commands!\n',
          ].join('\n'),
          stderr: '',
          exitCode: 0,
        };
      }

      let stdout = '';
      let stderr = '';

      pyodide.setStdout({
        write: (buf: Uint8Array) => {
          stdout += new TextDecoder().decode(buf);
          return buf.length; // Crucial: return byte count
        },
      });
      pyodide.setStderr({
        write: (buf: Uint8Array) => {
          stderr += new TextDecoder().decode(buf);
          return buf.length; // Crucial: return byte count
        },
      });

      const currentCwd = ctx.cwd || '/';

      // 1. Pre-execution: Sync files from just-bash VFS -> Pyodide WASM FS
      if (fs) {
        try {
          const files = await fs.readdir(currentCwd);
          for (const file of files) {
            const filePath = `${currentCwd}/${file}`.replace(/\/+/g, '/');
            try {
              const content = await fs.readFile(filePath);
              pyodide.FS.writeFile(file, content);
            } catch {
              // Skip directory or non-file entries
            }
          }
        } catch {
          // Ignore list failures
        }
      }

      // 2. Prepare code to execute
      let codeToRun = '';
      let scriptName = '';

      if (args[0] === '-c') {
        if (!args[1]) {
          return { stdout: '', stderr: 'python: option -c requires an argument\n', exitCode: 1 };
        }
        codeToRun = args[1];
      } else {
        scriptName = args[0];
        let fileReadSuccess = false;
        if (fs) {
          try {
            codeToRun = await fs.readFile(scriptName);
            fileReadSuccess = true;
          } catch {
            // Fallthrough to try reading directly from Pyodide FS
          }
        }
        if (!fileReadSuccess) {
          try {
            codeToRun = pyodide.FS.readFile(scriptName, { encoding: 'utf8' });
          } catch {
            return {
              stdout: '',
              stderr: `python: can't open file '${scriptName}': [Errno 2] No such file or directory\n`,
              exitCode: 2,
            };
          }
        }
      }

      // Pass sys.argv
      const pyArgs = args[0] === '-c' ? ['-c', ...args.slice(2)] : args;
      pyodide.registerJsModule('_sys_args', pyArgs);
      await pyodide.runPythonAsync(`
import sys, _sys_args
sys.argv = list(_sys_args)
`);

      // 3. Run code and capture REPL evaluation result if no stdout written
      const result = await pyodide.runPythonAsync(codeToRun);
      if (result !== undefined && result !== null && stdout === '') {
        try {
          const strVal = typeof result === 'object' && result?.toString ? result.toString() : String(result);
          if (strVal !== '[object Object]' && strVal !== 'None') {
            stdout = `${strVal}\n`;
          }
        } catch {
          // Ignore string conversion errors
        }
      }

      // 4. Post-execution: Sync output files from Pyodide WASM FS -> just-bash VFS
      if (fs) {
        try {
          const pyFiles = pyodide.FS.readdir('.');
          for (const file of pyFiles) {
            if (file === '.' || file === '..') continue;
            try {
              const stat = pyodide.FS.stat(file);
              if (pyodide.FS.isDir(stat.mode)) continue;

              const content = pyodide.FS.readFile(file, { encoding: 'utf8' });
              const targetPath = `${currentCwd}/${file}`.replace(/\/+/g, '/');
              await fs.writeFile(targetPath, content);
            } catch {
              // Ignore unreadable files
            }
          }
        } catch {
          // Ignore sync errors
        }
      }

      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: '',
        stderr: cleanPythonError(err),
        exitCode: 1,
      };
    }
  });
}
