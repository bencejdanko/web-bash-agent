import { useRef } from 'react';
import { BashSandbox } from '../bashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps } from '../types';
import { discoverSkills } from '../skills';

export const useAgentInitialization = (props: AgentSidebarProps) => {
  const bashSandboxRef = useRef<BashSandbox | null>(null);
  const llmBridgeRef = useRef<LlmBridge | null>(null);

  if (!bashSandboxRef.current) {
    const pf = typeof window !== 'undefined' ? (window as any).pagefind : null;
    bashSandboxRef.current = props.bashSandbox || new BashSandbox({
      files: props.filesystem || {},
      pagefind: pf,
    });
  }

  if (!llmBridgeRef.current) {
    const bridge = props.llmBridge || new LlmBridge({
      apiKey: props.apiKey || '',
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
    }, props.model || 'openai/gpt-4o-mini');

    // Discover skills from filesystem if not explicitly provided
    const skills = props.skills || discoverSkills(props.filesystem || {});
    bridge.setSkills(skills);
    llmBridgeRef.current = bridge;
  }


  const bashSandbox = bashSandboxRef.current;
  const llmBridge = llmBridgeRef.current;

  if (!bashSandbox || !llmBridge) {
    throw new Error('Initialization failed');
  }

  return {
    bashSandbox,
    llmBridge,
    skills: llmBridge.skills
  };
};

