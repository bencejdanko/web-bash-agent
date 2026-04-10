import { BaseComponent } from '../BaseComponent';

interface ThinkingIndicatorProps {
    isProcessing: boolean;
    turnStartTime: number | null;
}

export class ThinkingIndicator extends BaseComponent<ThinkingIndicatorProps> {
    private timer: any = null;
    private startTime: number | null = null;

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'thinking-indicator-wrapper';
        div.style.display = 'none';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.style.paddingLeft = '4px';
        return div;
    }

    init() {
        this.render();
    }

    render() {
        if (!this.props.isProcessing) {
            this.element.style.display = 'none';
            this.stopTimer();
            return;
        }

        const newStartTime = this.props.turnStartTime || Date.now();
        const startTimeChanged = newStartTime !== this.startTime;

        this.element.style.display = 'flex';
        
        if (this.element.innerHTML === '' || startTimeChanged) {
            this.element.innerHTML = `
                <div class="thinking-indicator" style="margin-top: 0">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                </div>
                <div id="thinking-timer" style="font-size: 12px; color: var(--agent-text-dim); font-family: 'Inter', sans-serif">
                    thinking for 0s
                </div>
            `;
            this.startTime = newStartTime;
            this.startTimer();
            this.updateTimerText();
        }
    }

    private updateTimerText() {
        if (!this.startTime) return;
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const timerEl = this.query('#thinking-timer');
        if (timerEl) {
            timerEl.textContent = `thinking for ${elapsed}s`;
        }
    }

    private startTimer() {
        this.stopTimer();
        this.timer = setInterval(() => this.updateTimerText(), 1000);
    }

    private stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    destroy() {
        this.stopTimer();
    }
}
