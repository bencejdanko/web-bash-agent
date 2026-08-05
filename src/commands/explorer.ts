import { defineCommand } from 'just-bash/browser';
import { MinimalWindowModal } from './windowModal';
import { openNotepadModal } from './notepad';

export interface ExplorerOptions {
  initialPath?: string;
  fs: any;
}

interface FileItem {
  name: string;
  fullPath: string;
  isDir: boolean;
}

export class MinimalExplorerModal extends MinimalWindowModal {
  private fs: any;
  private currentPath: string;
  private treeContainer: HTMLElement;

  constructor(options: ExplorerOptions) {
    const path = options.initialPath || '/';
    super({
      title: `File Explorer - ${path}`,
      statusText: `Path: ${path} | Double-click a file to edit in Notepad`,
      width: 560,
      height: 420,
    });

    this.fs = options.fs;
    this.currentPath = path;

    const refreshBtn = this.createButton('Refresh', (e) => {
      e.preventDefault();
      this.refresh();
    });

    const closeBtn = this.createButton('Close', (e) => {
      e.preventDefault();
      this.close();
    });

    this.buttonGroup.appendChild(refreshBtn);
    this.buttonGroup.appendChild(closeBtn);

    this.treeContainer = document.createElement('div');
    this.treeContainer.style.cssText = `
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.5;
      background: #ffffff;
      color: #000000;
    `;

    this.contentArea.appendChild(this.treeContainer);
    this.refresh();
  }

  public async refresh() {
    this.treeContainer.innerHTML = '<div style="color: #666;">Loading files...</div>';
    this.setTitle(`File Explorer - ${this.currentPath}`);
    this.setStatus(`Path: ${this.currentPath} | Double-click a file to edit in Notepad`);

    try {
      const treeNode = await this.renderDirectory(this.currentPath);
      this.treeContainer.innerHTML = '';
      this.treeContainer.appendChild(treeNode);
    } catch (err: any) {
      this.treeContainer.innerHTML = `<div style="color: #cc0000;">Error listing directory: ${err?.message || err}</div>`;
    }
  }

  private async fetchEntries(dirPath: string): Promise<FileItem[]> {
    if (!this.fs) return [];

    try {
      const names: string[] = await this.fs.readdir(dirPath);
      const items: FileItem[] = [];

      for (const name of names) {
        if (name === '.' || name === '..') continue;
        const fullPath = (dirPath === '/' ? `/${name}` : `${dirPath}/${name}`).replace(/\/+/g, '/');
        let isDir = false;

        try {
          const stat = await this.fs.stat(fullPath);
          isDir = typeof stat.isDirectory === 'function' ? stat.isDirectory() : Boolean(stat.isDirectory);
        } catch {
          // If stat fails, check if readdir succeeds (it's a directory)
          try {
            await this.fs.readdir(fullPath);
            isDir = true;
          } catch {
            isDir = false;
          }
        }

        items.push({ name, fullPath, isDir });
      }

      return items.sort((a, b) => {
        if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
        return a.isDir ? -1 : 1;
      });
    } catch (e) {
      // Fallback for virtual fs with getAllPaths
      if (typeof this.fs.getAllPaths === 'function') {
        const allPaths: string[] = this.fs.getAllPaths();
        const prefix = dirPath === '/' ? '/' : `${dirPath}/`;
        const directChildren = new Map<string, FileItem>();

        for (const p of allPaths) {
          if (!p.startsWith(prefix) || p === dirPath) continue;
          const relative = p.slice(prefix.length);
          const parts = relative.split('/');
          const name = parts[0];
          if (!name) continue;
          const fullPath = (prefix + name).replace(/\/+/g, '/');
          const isDir = parts.length > 1;

          if (!directChildren.has(name) || isDir) {
            directChildren.set(name, { name, fullPath, isDir });
          }
        }

        return Array.from(directChildren.values()).sort((a, b) => {
          if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
          return a.isDir ? -1 : 1;
        });
      }
      return [];
    }
  }

  private async renderDirectory(dirPath: string): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'explorer-tree-group';
    container.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const entries = await this.fetchEntries(dirPath);

    if (entries.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color: #888; font-style: italic; padding-left: 14px;';
      emptyMsg.textContent = '(empty directory)';
      container.appendChild(emptyMsg);
      return container;
    }

    for (const item of entries) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        flex-direction: column;
        user-select: none;
      `;

      const itemHeader = document.createElement('div');
      itemHeader.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 6px;
        cursor: pointer;
        border-radius: 2px;
      `;

      itemHeader.onmouseenter = () => (itemHeader.style.background = '#f2f2f2');
      itemHeader.onmouseleave = () => {
        if (!itemHeader.dataset.selected) itemHeader.style.background = 'transparent';
      };

      const marker = document.createElement('span');
      marker.style.cssText = 'font-size: 12px; min-width: 24px; display: inline-block; font-family: monospace; font-weight: bold; color: #555;';
      marker.textContent = item.isDir ? '[+]' : '  -';

      const label = document.createElement('span');
      label.textContent = item.isDir ? `${item.name}/` : item.name;
      label.style.cssText = item.isDir ? 'font-weight: bold; color: #000;' : 'color: #333;';

      itemHeader.appendChild(marker);
      itemHeader.appendChild(label);
      row.appendChild(itemHeader);

      let subContainer: HTMLElement | null = null;
      let isExpanded = false;

      const selectItem = () => {
        // Clear previous selections
        this.treeContainer.querySelectorAll('[data-selected]').forEach((el) => {
          delete (el as HTMLElement).dataset.selected;
          (el as HTMLElement).style.background = 'transparent';
        });
        itemHeader.dataset.selected = 'true';
        itemHeader.style.background = '#e0e0e0';
        this.setStatus(`Selected: ${item.fullPath} | Double-click a file to edit in Notepad`);
      };

      itemHeader.onclick = async (e: MouseEvent) => {
        e.stopPropagation();
        selectItem();

        if (item.isDir) {
          isExpanded = !isExpanded;
          marker.textContent = isExpanded ? '[-]' : '[+]';

          if (isExpanded) {
            if (!subContainer) {
              subContainer = document.createElement('div');
              subContainer.style.cssText = 'padding-left: 18px; border-left: 1px dotted #ccc; margin-left: 8px;';
              subContainer.innerHTML = '<div style="color: #888; font-size: 11px;">Loading...</div>';
              row.appendChild(subContainer);

              const renderedSub = await this.renderDirectory(item.fullPath);
              subContainer.innerHTML = '';
              subContainer.appendChild(renderedSub);
            } else {
              subContainer.style.display = 'block';
            }
          } else if (subContainer) {
            subContainer.style.display = 'none';
          }
        }
      };

      // Double Click Action: Open File in Notepad!
      itemHeader.ondblclick = async (e: MouseEvent) => {
        e.stopPropagation();
        if (!item.isDir) {
          this.setStatus(`Opening ${item.name} in Notepad...`);
          await openNotepadModal({
            filename: item.name,
            filePath: item.fullPath,
            fs: this.fs,
          });
          this.setStatus(`Opened: ${item.fullPath}`);
        }
      };

      container.appendChild(row);
    }

    return container;
  }
}

/**
 * Reusable helper to open File Explorer modal.
 */
export function openExplorerModal(options: ExplorerOptions) {
  const modal = new MinimalExplorerModal(options);
  modal.show();
  return modal;
}


async function runExplorer(args: string[], ctx: any, context?: { getFs?: () => any }) {
  try {
    const fs = (context?.getFs ? context.getFs() : null) || ctx.fs;
    const currentCwd = ctx.cwd || '/';
    const targetDir = args[0]
      ? args[0].startsWith('/')
        ? args[0]
        : `${currentCwd}/${args[0]}`.replace(/\/+/g, '/')
      : currentCwd;

    if (typeof document !== 'undefined') {
      const modal = new MinimalExplorerModal({
        initialPath: targetDir,
        fs,
      });
      modal.show();
    }

    return {
      stdout: `File Explorer opened for ${targetDir}\n`,
      stderr: '',
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `explorer error: ${err?.message || String(err)}\n`,
      exitCode: 1,
    };
  }
}

/**
 * Creates `explorer` command for launching the File Explorer window modal.
 */
export function createExplorerCommand(context?: { getFs?: () => any }) {
  return defineCommand('explorer', async (args, ctx) => {
    return await runExplorer(args, ctx, context);
  });
}

/**
 * Alias command `files` for `explorer`.
 */
export function createFilesCommand(context?: { getFs?: () => any }) {
  return defineCommand('files', async (args, ctx) => {
    return await runExplorer(args, ctx, context);
  });
}

if (typeof window !== 'undefined') {
  (window as any).explorer = (path?: string) => {
    const fs = (window as any).fs?._raw || (window as any).bashSandbox?.fs;
    const modal = new MinimalExplorerModal({
      initialPath: path || '/',
      fs,
    });
    modal.show();
    return modal;
  };

  (window as any).files = (window as any).explorer;

  (window as any).notepad = async (fileOrPath?: string) => {
    const fs = (window as any).fs?._raw || (window as any).bashSandbox?.fs;
    const target = fileOrPath || 'untitled.txt';
    const currentCwd = (window as any).bashSandbox?.getCwd() || '/';
    const filePath = target.startsWith('/') ? target : `${currentCwd}/${target}`.replace(/\/+/g, '/');
    const filename = filePath.split('/').pop() || target;
    return await openNotepadModal({ filename, filePath, fs });
  };
}

