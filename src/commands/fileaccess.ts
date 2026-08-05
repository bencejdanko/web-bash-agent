import { defineCommand } from 'just-bash/browser';

const FSA_NOT_AVAILABLE = 'File System Access API not available in this browser (requires Chrome/Edge 86+).';

function normalizePath(p: string, cwd: string): string {
  if (!p) return cwd;
  return (p.startsWith('/') ? p : `${cwd}/${p}`).replace(/\/+/g, '/');
}

/**
 * `open [vfs-path]` — Opens the OS file picker and writes selected file(s) into the VFS.
 * With no args, files land at CWD using their original filenames.
 * With a path arg and a single file selected, that path is used as the filename.
 * With a path arg and multiple files, the path is used as a directory prefix.
 */
export function createOpenCommand() {
  return defineCommand('open', async (args, ctx) => {
    if (typeof window === 'undefined' || !('showOpenFilePicker' in window)) {
      return { stdout: '', stderr: `open: ${FSA_NOT_AVAILABLE}\n`, exitCode: 1 };
    }

    try {
      const handles: any[] = await (window as any).showOpenFilePicker({ multiple: true });
      const cwd = ctx.cwd || '/';
      const loaded: string[] = [];

      for (const handle of handles) {
        const file = await handle.getFile();
        const text = await file.text();

        let targetPath: string;
        if (args[0]) {
          const base = normalizePath(args[0], cwd);
          targetPath = handles.length === 1 ? base : `${base}/${file.name}`.replace(/\/+/g, '/');
        } else {
          targetPath = `${cwd}/${file.name}`.replace(/\/+/g, '/');
        }

        await ctx.fs.writeFile(targetPath, text);
        loaded.push(targetPath);
      }

      return {
        stdout: `Loaded ${loaded.length} file(s) into VFS:\n${loaded.map(p => `  ${p}`).join('\n')}\n`,
        stderr: '',
        exitCode: 0,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { stdout: 'Cancelled.\n', stderr: '', exitCode: 0 };
      return { stdout: '', stderr: `open: ${err?.message || err}\n`, exitCode: 1 };
    }
  });
}

/**
 * `save <vfs-path>` — Reads a file from the VFS and opens the OS save dialog.
 * The user picks where to save it on their real filesystem.
 */
export function createSaveCommand() {
  return defineCommand('save', async (args, ctx) => {
    if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
      return { stdout: '', stderr: `save: ${FSA_NOT_AVAILABLE}\n`, exitCode: 1 };
    }

    if (!args[0]) {
      return { stdout: '', stderr: 'Usage: save <vfs-path>\n', exitCode: 1 };
    }

    const cwd = ctx.cwd || '/';
    const vfsPath = normalizePath(args[0], cwd);
    const filename = vfsPath.split('/').pop() || 'file';

    try {
      const content = await ctx.fs.readFile(vfsPath);

      const handle = await (window as any).showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      return { stdout: `Saved ${vfsPath} to disk.\n`, stderr: '', exitCode: 0 };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { stdout: 'Cancelled.\n', stderr: '', exitCode: 0 };
      return { stdout: '', stderr: `save: ${err?.message || err}\n`, exitCode: 1 };
    }
  });
}

/**
 * `open-dir [vfs-prefix]` — Opens the OS directory picker and recursively loads
 * all text files into the VFS. Defaults to /<dirname> as the mount prefix.
 */
export function createOpenDirCommand() {
  return defineCommand('open-dir', async (args, ctx) => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      return { stdout: '', stderr: `open-dir: ${FSA_NOT_AVAILABLE}\n`, exitCode: 1 };
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      const prefix = args[0]
        ? normalizePath(args[0], ctx.cwd || '/').replace(/\/$/, '')
        : `/${dirHandle.name}`;

      const loaded: string[] = [];
      const skipped: string[] = [];

      async function readDir(handle: any, vfsDir: string) {
        for await (const [name, entry] of handle.entries()) {
          if (name.startsWith('.')) continue; // skip hidden
          const vfsPath = `${vfsDir}/${name}`;
          if (entry.kind === 'directory') {
            await readDir(entry, vfsPath);
          } else {
            try {
              const file = await entry.getFile();
              const text = await file.text();
              await ctx.fs.writeFile(vfsPath, text);
              loaded.push(vfsPath);
            } catch {
              skipped.push(vfsPath);
            }
          }
        }
      }

      await readDir(dirHandle, prefix);

      const lines = [`Loaded ${loaded.length} file(s) into VFS under ${prefix}:`];
      for (const p of loaded) lines.push(`  ${p}`);
      if (skipped.length) lines.push(`Skipped ${skipped.length} unreadable file(s).`);
      lines.push('');

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { stdout: 'Cancelled.\n', stderr: '', exitCode: 0 };
      return { stdout: '', stderr: `open-dir: ${err?.message || err}\n`, exitCode: 1 };
    }
  });
}
