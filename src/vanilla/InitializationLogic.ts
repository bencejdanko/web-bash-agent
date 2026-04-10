import { PersistentBashSandbox } from './PersistentBashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps, ModelConfig } from '../types';
import { discoverSkills } from '../skills';
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

            const discoveredSkills = this.props.skills || discoverSkills(this.props.filesystem || {});
            
            const skillContext = { skills: discoveredSkills };
            const pagefindContext = { pagefind: typeof window !== 'undefined' ? (window as any).pagefind : null };

            // Build Tools
            const toolConfigs = [{ type: 'bash' }, { type: 'load-skill' }];
            const finalTools: any[] = [];
            for (const config of toolConfigs) {
                const result = await registry.getTool(config, skillContext);
                if (Array.isArray(result)) finalTools.push(...result);
                else if (result) finalTools.push(result);
            }

            // Build Commands
            const customCommands: any[] = [];
            const commandConfigs = this.props.customBashCommands || [];
            for (const config of commandConfigs) {
                const cmd = await registry.getCommand(config, pagefindContext);
                if (Array.isArray(cmd)) customCommands.push(...cmd);
                else if (cmd) customCommands.push(cmd);
            }

            this.bashSandbox = this.props.bashSandbox as any || new PersistentBashSandbox({
                files: this.props.filesystem || {},
                pagefind: pagefindContext.pagefind,
                customCommands,
                normalizePaths: true
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
                systemPrompt: this.props.systemPrompt,
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
                actualFilesystem: this.bashSandbox.getFilesystem()
            });

            return {
                bashSandbox: this.bashSandbox,
                llmBridge: this.llmBridge,
                skills: discoveredSkills
            };

        } catch (error) {
            console.error('Sandbox initialization failed:', error);
            this.store.setState({ isInitializing: false });
            throw error;
        }
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
