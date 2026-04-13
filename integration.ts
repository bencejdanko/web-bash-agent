import type { AstroIntegration } from 'astro';
import { getAgentContextFilesystem } from './src/filesystem';

export interface IntegrationOptions {
  models: any[];
  mounts: Record<string, string>;
  initialModelId?: string;
}

export function pagefindAgent(options: IntegrationOptions): AstroIntegration {
    return {
        name: 'pagefind-bash-agent-astro',
        hooks: {
            'astro:config:setup': ({ injectScript, updateConfig }) => {
                const mounts = options.mounts || {};
                
                // 1. Gather filesystem on server side (SSR-compatible)
                const filesystem = getAgentContextFilesystem(mounts);

                const configBlob = {
                    models: options.models,
                    filesystem,
                    initialModelId: options.initialModelId
                };

                // 2. Inject Config to head of every page
                injectScript('head-inline', `
                    (function() {
                        const script = document.createElement('script');
                        script.id = 'pagefind-agent-config';
                        script.type = 'application/json';
                        script.textContent = \`${JSON.stringify(configBlob).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                        document.head.appendChild(script);
                    })();
                `);

                // 3. Inject Island hydration script from the pre-built bundle
                injectScript('page', 'import "pagefind-bash-agent-astro/AgentIsland";');

                // 4. Vite optimization settings
                updateConfig({
                  vite: {
                    optimizeDeps: {
                      exclude: ['pagefind-bash-agent-astro']
                    }
                  }
                });
            },
        },
    };
}

export default pagefindAgent;
