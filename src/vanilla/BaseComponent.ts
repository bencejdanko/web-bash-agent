export abstract class BaseComponent<P = any> {
    protected element: HTMLElement;
    protected props: P;

    constructor(props: P) {
        this.props = props;
        this.element = this.createRootElement();
    }

    /**
     * Creates the root element for the component.
     * Override this if you need a specific tag name or classes.
     */
    protected createRootElement(): HTMLElement {
        return document.createElement('div');
    }

    /**
     * Initial setup, called once after the element is created.
     */
    protected init() {}

    /**
     * Renders the component's internal structure.
     */
    abstract render(): void;

    /**
     * Returns the DOM element for this component.
     */
    getElement(): HTMLElement {
        return this.element;
    }

    /**
     * Updates the component with new props and re-renders.
     */
    update(newProps: Partial<P>) {
        this.props = { ...this.props, ...newProps };
        this.render();
    }

    /**
     * Helper to find an element within the component.
     */
    protected query<T extends HTMLElement>(selector: string): T | null {
        return this.element.querySelector(selector);
    }
}
