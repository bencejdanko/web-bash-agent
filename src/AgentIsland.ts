/**
 * Initializes the Agent Sidebar on the client.
 * Using a dynamic import for the main sidebar to keep it out of the server bundle.
 */
export async function initAgentIsland() {
    if (typeof window === 'undefined') return;

    const configEl = document.getElementById('agent-sidebar-config');
    if (!configEl) return;

    try {
        const configText = configEl.textContent || '{}';
        const config = JSON.parse(configText);
        const { models, filesystem, initialModelId } = config;

        // 1. Dynamic Import of the Vanilla Sidebar UI
        const { AgentSidebar } = await import('./vanilla/components/AgentSidebar');

        // 2. Mount Vanilla Sidebar
        let container = document.getElementById('agent-sidebar-island');
        if (!container) {
            container = document.createElement('div');
            container.id = 'agent-sidebar-island';
            document.body.appendChild(container);
        }

        const sidebar = new AgentSidebar({
            models,
            initialModelId: initialModelId || models[0]?.id,
            filesystem
        });
        
        container.innerHTML = '';
        container.appendChild(sidebar.getElement());
        sidebar.init();

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
