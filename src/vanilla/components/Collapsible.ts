import { BaseComponent } from '../BaseComponent';
import { ChevronRight } from './Icons';

interface CollapsibleProps {
    title: string | HTMLElement;
    isOpen: boolean;
    onToggle: () => void;
    content: string | HTMLElement | HTMLElement[];
}

export class Collapsible extends BaseComponent<CollapsibleProps> {
    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'agent-collapsible-container';
        return div;
    }

    render() {
        this.element.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = `agent-collapsible-header ${this.props.isOpen ? 'open' : ''}`;
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.cursor = 'pointer';
        header.style.padding = '4px 8px';
        header.style.borderRadius = '4px';
        
        const icon = document.createElement('span');
        icon.className = 'collapsible-icon';
        icon.style.transition = 'transform 0.2s';
        icon.style.transform = this.props.isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
        icon.innerHTML = ChevronRight(14);
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'collapsible-title';
        titleContainer.style.fontSize = '12px';
        titleContainer.style.fontWeight = '500';
        titleContainer.style.color = 'var(--agent-text-dim)';
        if (typeof this.props.title === 'string') {
            titleContainer.textContent = this.props.title;
        } else {
            titleContainer.appendChild(this.props.title);
        }

        header.appendChild(icon);
        header.appendChild(titleContainer);
        header.addEventListener('click', this.props.onToggle);


        const contentContainer = document.createElement('div');
        contentContainer.className = 'collapsible-content';
        contentContainer.style.display = this.props.isOpen ? 'block' : 'none';
        contentContainer.style.padding = '8px 0';

        if (typeof this.props.content === 'string') {
            contentContainer.innerHTML = this.props.content;
        } else if (Array.isArray(this.props.content)) {
            this.props.content.forEach(c => contentContainer.appendChild(c));
        } else {
            contentContainer.appendChild(this.props.content);
        }

        this.element.appendChild(header);
        this.element.appendChild(contentContainer);
    }
}
