export interface WindowModalOptions {
  title: string;
  statusText?: string;
  width?: number;
  height?: number;
  top?: number;
  left?: number;
}

export class MinimalWindowModal {
  protected element: HTMLElement;
  protected titlebar: HTMLElement;
  protected titleText: HTMLSpanElement;
  protected buttonGroup: HTMLElement;
  protected statusbar: HTMLElement;
  protected contentArea: HTMLElement;

  private static topZIndex = 999990;

  constructor(options: WindowModalOptions) {
    const width = options.width || 540;
    const height = options.height || 400;
    const top = options.top ?? 80;
    const left = options.left ?? 80;

    const modal = document.createElement('div');
    MinimalWindowModal.topZIndex += 1;
    modal.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${width}px;
      height: ${height}px;
      background: #ffffff;
      border: 2px solid #000000;
      box-shadow: 4px 4px 0px rgba(0,0,0,0.15);
      z-index: ${MinimalWindowModal.topZIndex};
      display: flex;
      flex-direction: column;
      font-family: monospace, sans-serif;
      color: #000000;
      box-sizing: border-box;
      user-select: none;
    `;

    modal.addEventListener('mousedown', () => {
      MinimalWindowModal.topZIndex += 1;
      modal.style.zIndex = String(MinimalWindowModal.topZIndex);
    });

    this.titlebar = document.createElement('div');
    this.titlebar.style.cssText = `
      background: #f0f0f0;
      border-bottom: 1px solid #ccc;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: bold;
      user-select: none;
      cursor: move;
      flex-shrink: 0;
    `;

    this.titleText = document.createElement('span');
    this.titleText.textContent = options.title;

    this.buttonGroup = document.createElement('div');
    this.buttonGroup.style.cssText = 'display: flex; gap: 6px; align-items: center;';

    this.titlebar.appendChild(this.titleText);
    this.titlebar.appendChild(this.buttonGroup);

    this.statusbar = document.createElement('div');
    this.statusbar.style.cssText = `
      background: #fafafa;
      border-bottom: 1px solid #eee;
      padding: 4px 10px;
      font-size: 11px;
      color: #666;
      font-family: monospace, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    `;
    this.statusbar.textContent = options.statusText || '';

    this.contentArea = document.createElement('div');
    this.contentArea.style.cssText = `
      flex: 1;
      width: 100%;
      overflow: auto;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      background: #ffffff;
      color: #000000;
      user-select: text;
    `;

    modal.appendChild(this.titlebar);
    modal.appendChild(this.statusbar);
    modal.appendChild(this.contentArea);

    this.element = modal;

    // Draggable window logic
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    this.titlebar.onmousedown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX - modal.offsetLeft;
      startY = e.clientY - modal.offsetTop;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;
        moveEvent.preventDefault();
        const newLeft = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, moveEvent.clientX - startX));
        const newTop = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, moveEvent.clientY - startY));
        modal.style.left = `${newLeft}px`;
        modal.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }

  public setStatus(text: string) {
    this.statusbar.textContent = text;
  }

  public setTitle(text: string) {
    this.titleText.textContent = text;
  }

  protected createButton(label: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      cursor: pointer;
      font-size: 12px;
      font-family: monospace, sans-serif;
      padding: 2px 8px;
      background: #ffffff;
      border: 1px solid #999;
      border-radius: 2px;
    `;
    btn.onmouseenter = () => (btn.style.background = '#f0f0f0');
    btn.onmouseleave = () => (btn.style.background = '#ffffff');
    btn.onclick = onClick;
    return btn;
  }

  public show() {
    if (typeof document !== 'undefined') {
      document.body.appendChild(this.element);
    }
  }

  public close() {
    this.element.remove();
  }
}
