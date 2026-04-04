import { useRef } from 'react';
import { BashSandbox } from '../bashSandbox';
import { LlmBridge } from '../llmBridge';
import { AgentSidebarProps } from '../types';

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
    llmBridgeRef.current = props.llmBridge || new LlmBridge({
      apiKey: props.apiKey || '',
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
    }, props.model || 'openai/gpt-4o-mini');
  }

  return {
    bashSandbox: bashSandboxRef.current,
    llmBridge: llmBridgeRef.current,
  };
};
