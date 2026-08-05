import { defineCommand } from 'just-bash/browser';
import { loadPyodide } from 'pyodide';

let pyodidePromise: Promise<any> | null = null;

/**
 * Direct initialization of the Pyodide WebAssembly runtime environment from installed npm package.
 */
export function initPython(): Promise<any> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const cdnIndexUrl = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
      const cdnJsUrl = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

      if (typeof window !== 'undefined') {
        let loadFn = (globalThis as any).loadPyodide;
        if (!loadFn) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="pyodide.js"]');
            if (existingScript) {
              if ((globalThis as any).loadPyodide) return resolve();
              existingScript.addEventListener('load', () => resolve());
              existingScript.addEventListener('error', (e) => reject(e));
            } else {
              const script = document.createElement('script');
              script.src = cdnJsUrl;
              script.onload = () => resolve();
              script.onerror = (err) => reject(err);
              document.head.appendChild(script);
            }
          });
          loadFn = (globalThis as any).loadPyodide;
        }
        if (typeof loadFn === 'function') {
          return await loadFn({ indexURL: cdnIndexUrl });
        }
      }

      return await loadPyodide({ indexURL: cdnIndexUrl });
    })();
  }
  return pyodidePromise;
}

// Start loading Pyodide WebAssembly environment directly on import in browser environments
if (typeof window !== 'undefined') {
  initPython().catch(() => {});
}

function cleanPythonError(err: any): string {
  const msg = err?.message || String(err);
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
 * Creates a just-bash custom command for `python` with bi-directional VFS sync.
 * Usage: python -c "<code>" or python <script.py>
 */
export function createPythonCommand() {
  initPython();

  return defineCommand('python', async (args, ctx) => {
    try {
      const pyodide = await initPython();
      const fs = ctx.fs;

      if (args.length === 0) {
        return {
          stdout: 'Usage: python -c "<code>" or python <script.py>\n',
          stderr: '',
          exitCode: 0,
        };
      }

      let stdout = '';
      let stderr = '';

      pyodide.setStdout({
        write: (buf: Uint8Array) => {
          stdout += new TextDecoder().decode(buf);
          return buf.length;
        },
      });
      pyodide.setStderr({
        write: (buf: Uint8Array) => {
          stderr += new TextDecoder().decode(buf);
          return buf.length;
        },
      });

      const currentCwd = ctx.cwd || '/';

      // Sync files from just-bash VFS -> Pyodide WASM FS
      if (fs) {
        try {
          const files = await fs.readdir(currentCwd);
          for (const file of files) {
            const filePath = `${currentCwd}/${file}`.replace(/\/+/g, '/');
            try {
              const content = await fs.readFile(filePath);
              pyodide.FS.writeFile(file, content);
            } catch {
              // Skip directories or unreadable entries
            }
          }
        } catch {
          // Ignore list failures
        }
      }

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

      const pyArgs = args[0] === '-c' ? ['-c', ...args.slice(2)] : args;
      pyodide.registerJsModule('_sys_args', pyArgs);
      await pyodide.runPythonAsync(`
import sys, _sys_args
sys.argv = list(_sys_args)
`);

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

      // Sync output files from Pyodide WASM FS -> just-bash VFS
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

      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: cleanPythonError(err), exitCode: 1 };
    }
  });
}
