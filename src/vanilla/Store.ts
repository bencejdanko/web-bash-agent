type Listener<T> = (state: T) => void;

export class Store<T> {
    private state: T;
    private listeners: Set<Listener<T>> = new Set();

    constructor(initialState: T) {
        this.state = initialState;
    }

    getState(): T {
        return this.state;
    }

    setState(update: Partial<T> | ((state: T) => Partial<T>)) {
        const nextState = typeof update === 'function' ? { ...this.state, ...update(this.state) } : { ...this.state, ...update };
        
        if (JSON.stringify(this.state) !== JSON.stringify(nextState)) {
            this.state = nextState;
            this.notify();
        }
    }

    subscribe(listener: Listener<T>) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
