/**
 * Initializes the Agent Sidebar on the client.
 * Using a dynamic import for the main sidebar to keep it out of the server bundle.
 */
export async function initAgentIsland() {
    if (typeof window === 'undefined') return;

    const configEl = document.getElementById('pagefind-agent-config');
    if (!configEl) return;

    try {
        const configText = configEl.textContent || '{}';
        const config = JSON.parse(configText);
        const { models, systemPrompt, filesystem, initialModelId } = config;

        // 0. Dynamic import React and React-DOM/client
        const [React, { createRoot }] = await Promise.all([
            import('react'),
            import('react-dom/client')
        ]);

        // 1. Resolve Pagefind Base URL
        const astroBase = document.documentElement.getAttribute('data-astro-base') || '/';
        const base = astroBase.endsWith('/') ? astroBase : astroBase + '/';

        // 2. Connect to Pagefind
        try {
            const pagefind = await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`);
            (window as any).pagefind = pagefind;
        } catch (e) {
            console.warn('Agent Search: Pagefind index not available.');
        }

        // 3. Dynamic Import of the Sidebar UI
        // We use a relative path to ensure Vite handles the source-to-source compilation
        const { AgentSidebar } = await import('./AgentSidebar');

        // 4. Mount React root
        let container = document.getElementById('pagefind-agent-island');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pagefind-agent-island';
            document.body.appendChild(container);
        }

        const root = createRoot(container);
        root.render(
            <AgentSidebar 
                models={models}
                initialModelId={initialModelId || models[0]?.id}
                systemPrompt={systemPrompt}
                filesystem={filesystem}
            />
        );

    } catch (err) {
        console.error('Agent Island failed to initialize:', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAgentIsland);
    } else {
        initAgentIsland();
    }
}
