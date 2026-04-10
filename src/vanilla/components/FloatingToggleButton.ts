import { BaseComponent } from '../BaseComponent';
import { BotIcon } from './Icons';

interface FloatingToggleButtonProps {
  onClick: () => void;
}

export class FloatingToggleButton extends BaseComponent<FloatingToggleButtonProps> {
    protected createRootElement(): HTMLElement {
        const btn = document.createElement('button');
        btn.className = 'floating-control-button';
        btn.setAttribute('aria-label', 'Agent');
        return btn;
    }

    render() {
        this.element.innerHTML = BotIcon();
        this.element.addEventListener('click', this.props.onClick);
    }
}
