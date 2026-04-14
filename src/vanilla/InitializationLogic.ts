import { PersistentBashSandbox } from './PersistentBashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps } from '../types';
import { discoverInjections } from '../skills';
import { registry } from '../registry';
import { Store } from './Store';
import { AgentState } from './ChatLogic';

export class InitializationLogic {
    private store: Store<AgentState>;
    private props: AgentSidebarProps;
    private bashSandbox: PersistentBashSandbox | null = null;
    private llmBridge: LlmBridge | null = null;

    constructor(store: Store<AgentState>, props: AgentSidebarProps) {
        this.store = store;
        this.props = props;
    }

    async init() {
        try {
            const state = this.store.getState();
            const currentModelConfig = this.props.models.find(m => m.id === state.currentModelId) || this.props.models[0];

            const filesystem = this.props.filesystem || {};
            
            // Discover all injections across the entire mounted filesystem
            const injections = discoverInjections(filesystem);
            
            const pagefindContext = { pagefind: typeof window !== 'undefined' ? (window as any).pagefind : null };

            // Build Tools
            const finalTools = await this.buildTools(injections);

            // Build Commands
            let customCommands: any[] = [];
            const commandConfigs = this.props.customBashCommands;
            
            if (typeof commandConfigs === 'function') {
                // If it's a factory function, we'll pass it to the sandbox to handle late-bound FS
                (this as any)._customCommandFactory = commandConfigs;
            } else if (Array.isArray(commandConfigs)) {
                for (const config of commandConfigs) {
                    const cmd = await registry.getCommand(config, pagefindContext);
                    if (Array.isArray(cmd)) {
                        customCommands.push(...cmd);
                    } else if (cmd) {
                        customCommands.push(cmd);
                    }
                }
            }

            this.bashSandbox = this.props.bashSandbox as any || new PersistentBashSandbox({
                files: this.props.filesystem || {},
                pagefind: pagefindContext.pagefind,
                customCommands: (this as any)._customCommandFactory ? (ctx: any) => (this as any)._customCommandFactory(ctx) : customCommands,
                normalizePaths: false,
                cwd: state.terminalCwd || undefined,
                env: state.terminalEnv || undefined
            });

            const defaultHeaders: Record<string, string> = {};
            if (currentModelConfig.keyIdentifier) {
                defaultHeaders['X-Key-Identifier'] = currentModelConfig.keyIdentifier;
            }
            if (currentModelConfig.routerUrl) {
                defaultHeaders['X-Router-URL'] = currentModelConfig.routerUrl;
            }

            this.llmBridge = this.props.llmBridge || new LlmBridge({
                apiKey: currentModelConfig.apiKey || 'proxy-key', 
                model: currentModelConfig.id,
                systemPrompt: '', 
                baseURL: currentModelConfig.endpoint,
                dangerouslyAllowBrowser: true,
                tools: finalTools,
                defaultHeaders
            });

            if (!this.bashSandbox || !this.llmBridge) {
                throw new Error('Initialization failed: bashSandbox or llmBridge is null');
            }

            this.store.setState({ 
                isInitializing: false,
                actualFilesystem: this.bashSandbox.getFilesystem(),
                currentSystemPrompt: '',
                injections
            });

            return {
                bashSandbox: this.bashSandbox,
                llmBridge: this.llmBridge,
                injections
            };

        } catch (error: any) {
            console.error('Initialization failed:', error);
            this.store.setState({ 
                isInitializing: false,
            });
            throw error;
        }
    }

    private async buildTools(injections: any[]) {
        const skillContext = { skills: injections.filter(i => i.type === 'skill') };
        const toolConfigs = [{ type: 'bash' }, { type: 'load-skill' }];
        const finalTools: any[] = [];
        
        for (const config of toolConfigs) {
            const result = await registry.getTool(config, skillContext);
            if (Array.isArray(result)) {
                finalTools.push(...result);
            } else if (result) {
                finalTools.push(result);
            }
        }
        return finalTools;
    }

    updateModel(modelId: string) {
        const currentModelConfig = this.props.models.find(m => m.id === modelId);
        if (this.llmBridge && currentModelConfig) {
            const defaultHeaders: Record<string, string> = {};
            if (currentModelConfig.keyIdentifier) {
                defaultHeaders['X-Key-Identifier'] = currentModelConfig.keyIdentifier;
            }
            if (currentModelConfig.routerUrl) {
                defaultHeaders['X-Router-URL'] = currentModelConfig.routerUrl;
            }

            this.llmBridge.updateConfig({
                apiKey: currentModelConfig.apiKey || 'proxy-key',
                endpoint: currentModelConfig.endpoint,
                model: currentModelConfig.id,
                defaultHeaders
            });
            this.store.setState({ currentModelId: modelId });
        }
    }
}
