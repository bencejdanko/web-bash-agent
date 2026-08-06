import { defineCommand } from 'just-bash/browser';

function normalizePath(p: string, cwd: string): string {
  if (!p) return cwd;
  return (p.startsWith('/') ? p : `${cwd}/${p}`).replace(/\/+/g, '/');
}

/**
 * Ultra-minimalist native browser text editor command for Pugilister sandbox.
 * Native browser controls, draggable header, simple textarea, Ctrl+S / Esc support.
 */
export function createEditCommand() {
  return defineCommand('edit', async (args, ctx) => {
    const cwd = ctx.cwd || '/';
    const filePath = args[0] ? normalizePath(args[0], cwd) : `${cwd}/untitled.txt`.replace(/\/+/g, '/');
    const filename = filePath.split('/').pop() || 'untitled.txt';

    let initialContent = '';
    try {
      initialContent = await ctx.fs.readFile(filePath);
    } catch {}

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return {
        stdout: '',
        stderr: `edit: interactive editor requires a browser environment.\n`,
        exitCode: 1,
      };
    }

    return new Promise((resolve) => {
      document.getElementById('pugilister-edit-container')?.remove();

      // Native, unstyled floating dialog box
      const container = document.createElement('div');
      container.id = 'pugilister-edit-container';
      container.style.position = 'fixed';
      container.style.top = '80px';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.zIndex = '100000';
      container.style.background = '#ffffff';
      container.style.border = '1px solid #777777';
      container.style.padding = '4px';
      container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

      // Header bar (draggable)
      const header = document.createElement('div');
      header.style.cursor = 'move';
      header.style.userSelect = 'none';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '4px';
      header.style.paddingBottom = '2px';
      header.style.borderBottom = '1px solid #ccc';
      header.style.fontSize = '12px';
      header.style.fontFamily = 'monospace';

      const title = document.createElement('span');
      title.textContent = `${filename} (${filePath})`;

      const btnGroup = document.createElement('div');
      
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.style.marginRight = '4px';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';

      btnGroup.appendChild(saveBtn);
      btnGroup.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(btnGroup);

      // Plain unstyled native textarea
      const textarea = document.createElement('textarea');
      textarea.value = initialContent;
      textarea.rows = 16;
      textarea.cols = 70;
      textarea.style.display = 'block';
      textarea.style.fontFamily = 'monospace';

      container.appendChild(header);
      container.appendChild(textarea);
      document.body.appendChild(container);

      // Draggable logic
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      const onMouseDown = (e: MouseEvent) => {
        if (e.target === saveBtn || e.target === closeBtn) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        container.style.transform = 'none';
        container.style.left = `${initialLeft}px`;
        container.style.top = `${initialTop}px`;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.style.left = `${initialLeft + dx}px`;
        container.style.top = `${initialTop + dy}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      header.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      let isSaved = false;

      const saveFile = async () => {
        await ctx.fs.writeFile(filePath, textarea.value);
        isSaved = true;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = 'Save';
        }, 1200);
      };

      const closeEditor = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        container.remove();
        resolve({
          stdout: isSaved
            ? `Saved ${filePath} (${textarea.value.length} bytes)\n`
            : `Closed ${filePath}\n`,
          stderr: '',
          exitCode: 0,
        });
      };

      saveBtn.addEventListener('click', saveFile);
      closeBtn.addEventListener('click', closeEditor);

      textarea.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          await saveFile();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeEditor();
        }
      });

      setTimeout(() => textarea.focus(), 50);
    });
  });
}
