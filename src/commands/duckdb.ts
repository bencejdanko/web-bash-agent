import { defineCommand } from 'just-bash/browser';
import * as duckdb from '@duckdb/duckdb-wasm';

export interface DuckDBRuntime {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

let duckdbPromise: Promise<DuckDBRuntime> | null = null;

/**
 * Direct initialization of the DuckDB WASM runtime environment.
 */
export function initDuckDB(): Promise<DuckDBRuntime> {
  if (!duckdbPromise) {
    duckdbPromise = (async () => {
      const DUCKDB_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);

      if (typeof window !== 'undefined') {
        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );
        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        const conn = await db.connect();
        return { db, conn };
      } else {
        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        const conn = await db.connect();
        return { db, conn };
      }
    })();
  }
  return duckdbPromise;
}

// Start loading DuckDB WASM environment directly on import in browser environments
if (typeof window !== 'undefined') {
  initDuckDB().catch(() => {});
}

/**
 * Formats Apache Arrow / JS rows into a clean ASCII table.
 */
export function formatTable(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '0 rows returned.\n';
  const keys = Object.keys(rows[0]);

  const colWidths: Record<string, number> = {};
  for (const k of keys) {
    colWidths[k] = k.length;
  }

  for (const row of rows) {
    for (const k of keys) {
      const valStr = row[k] === null || row[k] === undefined ? 'NULL' : String(row[k]);
      if (valStr.length > (colWidths[k] || 0)) {
        colWidths[k] = valStr.length;
      }
    }
  }

  const header = keys.map((k) => k.padEnd(colWidths[k])).join(' | ');
  const separator = keys.map((k) => '-'.repeat(colWidths[k])).join('-+-');

  const body = rows
    .map((row) =>
      keys
        .map((k) => {
          const valStr = row[k] === null || row[k] === undefined ? 'NULL' : String(row[k]);
          return valStr.padEnd(colWidths[k]);
        })
        .join(' | ')
    )
    .join('\n');

  return `${header}\n${separator}\n${body}\n(${rows.length} row${rows.length === 1 ? '' : 's'})\n`;
}

/**
 * Helper to sync workspace dataset files from just-bash VFS into DuckDB WASM VFS.
 * Recursively scans all subdirectories and registers files under relative, absolute, and basename paths.
 */
async function syncWorkspaceToDuckDB(db: duckdb.AsyncDuckDB, fs: any, rootDir: string = '/') {
  if (!fs) return;

  const datasetExtensions = ['.csv', '.tsv', '.json', '.parquet', '.txt', '.tbl', '.dat'];

  const registerFile = async (virtualPath: string) => {
    const lastDot = virtualPath.lastIndexOf('.');
    const ext = lastDot !== -1 ? virtualPath.substring(lastDot).toLowerCase() : '';
    if (ext && !datasetExtensions.includes(ext)) return;

    try {
      const content = await fs.readFile(virtualPath);
      if (content === undefined || content === null) return;

      const isString = typeof content === 'string';
      const buffer = !isString
        ? content instanceof Uint8Array
          ? content
          : new Uint8Array(content)
        : null;

      const cleanPath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
      const absolutePath = '/' + cleanPath;
      const basename = cleanPath.split('/').pop() || cleanPath;

      const pathsToRegister = Array.from(new Set([cleanPath, absolutePath, basename, virtualPath]));

      for (const p of pathsToRegister) {
        if (!p) continue;
        try {
          if (isString) {
            await db.registerFileText(p, content);
          } else if (buffer) {
            await db.registerFileBuffer(p, buffer);
          }
        } catch {
          // Ignore registration duplicates
        }
      }
    } catch (e) {
      // Ignore read failures
    }
  };

  // 1. Try using fs.getAllPaths() if available on InMemoryFileSystem
  if (typeof fs.getAllPaths === 'function') {
    try {
      const allPaths: string[] = fs.getAllPaths();
      for (const p of allPaths) {
        await registerFile(p);
      }
      return;
    } catch {
      // Fallthrough to recursive walk
    }
  }

  // 2. Recursive directory walk with file/dir checks
  const visited = new Set<string>();
  async function walk(dir: string) {
    if (visited.has(dir)) return;
    visited.add(dir);

    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const fullPath = (dir === '/' ? `/${entry}` : `${dir}/${entry}`).replace(/\/+/g, '/');

        let isDir = false;
        let isFile = false;

        if (typeof fs.stat === 'function') {
          try {
            const st = await fs.stat(fullPath);
            if (st) {
              isDir = Boolean(st.isDirectory || (typeof st.isDirectory === 'function' && st.isDirectory()));
              isFile = Boolean(st.isFile || (typeof st.isFile === 'function' && st.isFile()));
            }
          } catch {
            // Ignore stat error
          }
        }

        if (isDir) {
          await walk(fullPath);
        } else if (isFile) {
          await registerFile(fullPath);
        } else {
          try {
            await walk(fullPath);
          } catch {
            await registerFile(fullPath);
          }
        }
      }
    } catch {
      // Not a directory or read error
    }
  }

  await walk(rootDir);
  if (rootDir !== '/') {
    await walk('/');
  }
}

/**
 * Creates a just-bash custom command for `duckdb` with SQL query execution
 * and bi-directional dataset syncing.
 * Usage: duckdb -c "SELECT ...;" or duckdb <script.sql>
 */
export function createDuckDBCommand() {
  initDuckDB();

  return defineCommand('duckdb', async (args, ctx) => {
    try {
      const { db, conn } = await initDuckDB();
      const fs = ctx.fs;

      // Sync CWD datasets into DuckDB VFS
      await syncWorkspaceToDuckDB(db, fs, ctx.cwd || '/');

      if (args.length === 0 && !ctx.stdin) {
        return {
          stdout: 'Usage: duckdb -c "SELECT ...;" or duckdb <script.sql>\n',
          stderr: '',
          exitCode: 0,
        };
      }



      // SINGLE EXECUTION MODE (e.g. duckdb -c "SELECT ...", duckdb script.sql, positional query string, or stdin pipe)
      let query = '';
      let isJsonOutput = args.includes('--json');
      let isCsvOutput = args.includes('--csv');

      const cIndex = args.indexOf('-c');
      if (cIndex !== -1 && args[cIndex + 1]) {
        query = args[cIndex + 1];
      } else if (args.length > 0 && !args[0].startsWith('-')) {
        const scriptPath = args[0];
        let fileReadSuccess = false;
        if (fs) {
          try {
            query = await fs.readFile(scriptPath);
            fileReadSuccess = true;
          } catch {
            // File read failed
          }
        }
        if (!fileReadSuccess) {
          const trimmedUpper = scriptPath.trim().toUpperCase();
          if (
            trimmedUpper.startsWith('SELECT') ||
            trimmedUpper.startsWith('WITH') ||
            trimmedUpper.startsWith('CREATE') ||
            trimmedUpper.startsWith('INSERT') ||
            trimmedUpper.startsWith('UPDATE') ||
            trimmedUpper.startsWith('DELETE') ||
            trimmedUpper.startsWith('DROP') ||
            trimmedUpper.startsWith('ALTER') ||
            trimmedUpper.startsWith('PRAGMA') ||
            trimmedUpper.startsWith('EXPLAIN') ||
            trimmedUpper.startsWith('DESCRIBE') ||
            trimmedUpper.startsWith('SHOW') ||
            trimmedUpper.endsWith(';')
          ) {
            query = scriptPath;
          } else {
            return {
              stdout: '',
              stderr: `duckdb: cannot open file '${scriptPath}'\n`,
              exitCode: 2,
            };
          }
        }
      } else if (ctx.stdin) {
        query = ctx.stdin;
      }

      if (!query.trim()) {
        return {
          stdout: '',
          stderr: 'Usage: duckdb -c "SELECT ...;" or duckdb query.sql\n',
          exitCode: 1,
        };
      }

      const table = await conn.query(query);
      const rows = table.toArray().map((r) => r.toJSON());

      let stdout = '';
      if (isJsonOutput) {
        stdout = JSON.stringify(rows, null, 2) + '\n';
      } else if (isCsvOutput) {
        if (rows.length > 0) {
          const keys = Object.keys(rows[0]);
          const csvLines = [keys.join(',')];
          for (const r of rows) {
            csvLines.push(keys.map((k) => JSON.stringify(r[k] ?? '')).join(','));
          }
          stdout = csvLines.join('\n') + '\n';
        } else {
          stdout = '\n';
        }
      } else {
        stdout = formatTable(rows);
      }

      return {
        stdout,
        stderr: '',
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: '',
        stderr: `DuckDB Error: ${err?.message || err}\n`,
        exitCode: 1,
      };
    }
  });
}
