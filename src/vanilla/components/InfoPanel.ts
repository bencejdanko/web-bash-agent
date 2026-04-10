import { BaseComponent } from '../BaseComponent';
import { XIcon } from './Icons';

interface InfoPanelProps {
  title: string;
  onClose: () => void;
  content: HTMLElement | HTMLElement[];
}

export class InfoPanel extends BaseComponent<InfoPanelProps> {
    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'var(--agent-overlay-bg)',
            zIndex: '110',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out',
            overflow: 'hidden'
        });
        return div;
    }

    init() {
        this.element.innerHTML = `
            <div class="info-overlay-content" style="display: flex; flex-direction: column; background-color: transparent; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); height: 100%">
                <header style="padding: 16px 20px; border-bottom: 1px solid var(--agent-bg-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--agent-header-glass)">
                    <span id="info-header-title" style="font-weight: 600; font-size: 15px; color: var(--agent-text-main)">${this.props.title}</span>
                    <button id="info-close" style="background: none; border: none; cursor: pointer; color: var(--agent-text-muted); display: flex; align-items: center; justify-content: center; padding: 4px; transition: color 0.2s">${XIcon(20)}</button>
                </header>
                <div class="info-list agent-scrollbar" style="flex: 1; overflow-y: auto; padding: 16px 20px"></div>
            </div>
        `;

        this.query('#info-close')?.addEventListener('click', this.props.onClose);
        this.render();
    }

    render() {
        const titleEl = this.query<HTMLElement>('#info-header-title')!;
        if (titleEl) titleEl.textContent = this.props.title;

        const list = this.query<HTMLElement>('.info-list')!;
        if (!list) return;

        list.innerHTML = '';
        if (Array.isArray(this.props.content)) {
            this.props.content.forEach(c => list.appendChild(c));
        } else {
            list.appendChild(this.props.content);
        }
    }
}
