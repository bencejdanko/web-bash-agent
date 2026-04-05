import { useMemo, useState, useEffect } from 'react';
import { BashSandbox } from '../bashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps, ModelConfig } from '../types';
import { discoverSkills } from '../skills';
import { registry } from '../registry';

export const useAgentInitialization = (props: AgentSidebarProps, currentModelConfig: ModelConfig) => {
  const [bashSandbox, setBashSandbox] = useState<BashSandbox | null>(null);
  const [llmBridge, setLlmBridge] = useState<LlmBridge | null>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Initialize Skills and Sandbox (Stable)
  useEffect(() => {
    const initSandbox = async () => {
      try {
        const discoveredSkills = props.skills || discoverSkills(props.filesystem || {});
        setSkills(discoveredSkills);

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
        const commandConfigs = props.customBashCommands || [];
        for (const config of commandConfigs) {
          const cmd = await registry.getCommand(config, pagefindContext);
          if (Array.isArray(cmd)) customCommands.push(...cmd);
          else if (cmd) customCommands.push(cmd);
        }

        const sandbox = props.bashSandbox || new BashSandbox({
          files: props.filesystem || {},
          pagefind: pagefindContext.pagefind,
          customCommands
        });

        setBashSandbox(sandbox);
        
        // Initial bridge creation if not exists
        if (!llmBridge && currentModelConfig) {
          const defaultHeaders: Record<string, string> = {};
          if (currentModelConfig.keyIdentifier) {
            defaultHeaders['X-Key-Identifier'] = currentModelConfig.keyIdentifier;
          }
          if (currentModelConfig.routerUrl) {
            defaultHeaders['X-Router-URL'] = currentModelConfig.routerUrl;
          }

          const bridge = props.llmBridge || new LlmBridge({
            apiKey: currentModelConfig.apiKey || 'proxy-key', 
            model: currentModelConfig.id, // Using ID as the model string for the API
            systemPrompt: props.systemPrompt,
            baseURL: currentModelConfig.endpoint,
            dangerouslyAllowBrowser: true,
            tools: finalTools,
            defaultHeaders
          });
          setLlmBridge(bridge);
        } else if (llmBridge) {
          // Update tools if they changed
          llmBridge.setTools(finalTools);
        }

      } catch (error) {
        console.error('Sandbox initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initSandbox();
  }, [props.filesystem, props.customBashCommands]); // Only re-init sandbox if these change

  // 2. Update Bridge (model, systemPrompt)
  useEffect(() => {
    if (llmBridge && currentModelConfig) {
        const defaultHeaders: Record<string, string> = {};
        if (currentModelConfig.keyIdentifier) {
          defaultHeaders['X-Key-Identifier'] = currentModelConfig.keyIdentifier;
        }
        if (currentModelConfig.routerUrl) {
          defaultHeaders['X-Router-URL'] = currentModelConfig.routerUrl;
        }

        llmBridge.updateConfig({
            apiKey: currentModelConfig.apiKey || 'proxy-key',
            endpoint: currentModelConfig.endpoint,
            model: currentModelConfig.id,
            defaultHeaders
        });
        llmBridge.setSystemPrompt(props.systemPrompt);
    }
  }, [currentModelConfig, props.systemPrompt]);


  return {
    bashSandbox,
    llmBridge,
    skills,
    isInitializing
  };
};
