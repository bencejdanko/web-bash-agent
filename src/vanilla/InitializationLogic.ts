import { PersistentBashSandbox } from './PersistentBashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps, ModelConfig, AgentProfile } from '../types';
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
            const currentAgent = this.props.agents.find(a => a.id === state.currentAgentId) || this.props.agents[0];

            if (!currentAgent) {
                throw new Error('Fatal configuration error: No agent profiles provided.');
            }

            const filesystem = this.props.filesystem || {};
            
            // Resolve prompt from filesystem - FATAL if missing
            const systemPromptPath = currentAgent.systemPromptPath;
            if (!systemPromptPath) {
                throw new Error(`Fatal configuration error: Agent "${currentAgent.id}" is missing a systemPromptPath.`);
            }

            const systemPrompt = filesystem[systemPromptPath];
            if (!systemPrompt) {
                throw new Error(`Fatal configuration error: System prompt file not found at virtual path "${systemPromptPath}". Check your agent configuration and mounts.`);
            }

            // Resolve skills explicitly (isolated per agent)
            const discoveredSkills = this.props.skills || (currentAgent.skillsDir ? discoverSkills(filesystem, currentAgent.skillsDir) : []);
            
            const skillContext = { skills: discoveredSkills };
            const pagefindContext = { pagefind: typeof window !== 'undefined' ? (window as any).pagefind : null };

            // Build Tools
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

            // Build Commands
            const customCommands: any[] = [];
            const commandConfigs = this.props.customBashCommands || [];
            for (const config of commandConfigs) {
                const cmd = await registry.getCommand(config, pagefindContext);
                if (Array.isArray(cmd)) {
                    customCommands.push(...cmd);
                } else if (cmd) {
                    customCommands.push(cmd);
                }
            }

            this.bashSandbox = this.props.bashSandbox as any || new PersistentBashSandbox({
                files: this.props.filesystem || {},
                pagefind: pagefindContext.pagefind,
                customCommands,
                normalizePaths: false, // Changed from true
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
                systemPrompt: systemPrompt,
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
                currentSystemPrompt: systemPrompt,
            });

            return {
                bashSandbox: this.bashSandbox,
                llmBridge: this.llmBridge,
                skills: discoveredSkills
            };

        } catch (error: any) {
            console.error('Initialization failed:', error);
            this.store.setState({ 
                isInitializing: false,
            });
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

    updateAgent(agentId: string) {
        try {
            const agent = this.props.agents.find(a => a.id === agentId);
            const state = this.store.getState();
            // ALWAYS use the original props filesystem for reliable prompt resolution
            const filesystem = this.props.filesystem || {};

            if (!agent) {
                throw new Error(`Fatal configuration error: Agent with ID "${agentId}" not found.`);
            }

            if (this.llmBridge && agent) {
                // Resolve prompt - FATAL if missing
                const systemPrompt = filesystem[agent.systemPromptPath];
                if (!systemPrompt) {
                    throw new Error(`Fatal configuration error: System prompt file not found at virtual path "${agent.systemPromptPath}" for agent "${agent.id}".`);
                }
                
                this.llmBridge.setSystemPrompt(systemPrompt);
                
                // Re-discover skills based on the agent's skillsDir (isolated)
                const discoveredSkills = agent.skillsDir ? discoverSkills(filesystem, agent.skillsDir) : [];
                
                this.store.setState({ 
                    currentAgentId: agentId, 
                    currentSystemPrompt: systemPrompt,
                    skills: discoveredSkills,
                });
            }
        } catch (error: any) {
            console.error('Agent update failed:', error);
        }
    }
}
