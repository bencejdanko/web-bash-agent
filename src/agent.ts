import { PersistentBashSandbox } from './PersistentBashSandbox';
import { LlmBridge } from './llmBridge';
import { ModelConfig, Message } from './types';
import { discoverInjections } from './skills';
import { registry } from './registry';
import { createPythonCommand } from './commands/python';
import { createNotepadCommand, createEditCommand } from './commands/notepad';
import { createExplorerCommand, createFilesCommand } from './commands/explorer';

export interface AgentOptions {
  filesystem?: Record<string, string>;
  models?: ModelConfig[];
  model?: string;
  apiKey?: string;
  endpoint?: string;
  maxIterations?: number;
  verbose?: boolean;
  bashSandbox?: PersistentBashSandbox;
  customBashCommands?: (ctx: any) => any[];
  systemPrompt?: string;
  defaultHeaders?: Record<string, string>;
  onLog?: (message: string, level?: 'info' | 'tool' | 'result' | 'error') => void;
  onStep?: (step: { iteration: number; toolCalls?: any[]; response?: string }) => void;
  onToolCall?: (toolCall: { name: string; args: any; result?: any }) => void;
}

export interface ToolCallRecord {
  name: string;
  args: any;
  result: any;
}

export interface AgentResult {
  success: boolean;
  output: string;
  iterations: number;
  messages: Message[];
  toolCalls: ToolCallRecord[];
}

export async function agent(prompt: string, options: AgentOptions = {}): Promise<AgentResult> {
  const verbose = options.verbose ?? true;
  const maxIterations = options.maxIterations ?? 15;

  const log = (msg: string, level: 'info' | 'tool' | 'result' | 'error' = 'info') => {
    if (options.onLog) {
      options.onLog(msg, level);
    }
  };

  if (verbose) {
    console.group(`🤖 Agent: "${prompt}"`);
  }

  try {
    // 1. Setup Sandbox
    const filesystem = options.filesystem || {};
    const defaultCustomCommands = (ctx: any) => [
      createPythonCommand(ctx),
      createNotepadCommand(ctx),
      createEditCommand(ctx),
      createExplorerCommand(ctx),
      createFilesCommand(ctx),
    ];
    const customCommandsFactory = options.customBashCommands || defaultCustomCommands;

    const sandbox = options.bashSandbox || new PersistentBashSandbox({
      files: filesystem,
      customCommands: customCommandsFactory,
      normalizePaths: false,
    });

    // 2. Setup Tools & LLM Bridge
    const injections = discoverInjections(filesystem);
    const skillContext = { skills: injections.filter((i) => i.type === 'skill') };
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

    const selectedModel = options.models?.find((m) => m.id === options.model) || options.models?.[0];
    const modelId = options.model || selectedModel?.id || 'gemini-2.5-flash';
    const apiKey = options.apiKey || selectedModel?.apiKey || 'proxy-key';
    const endpoint = options.endpoint || selectedModel?.endpoint;

    const defaultHeaders: Record<string, string> = { ...options.defaultHeaders };
    if (selectedModel?.keyIdentifier) {
      defaultHeaders['X-Key-Identifier'] = selectedModel.keyIdentifier;
    }
    if (selectedModel?.routerUrl) {
      defaultHeaders['X-Router-URL'] = selectedModel.routerUrl;
    }

    const llm = new LlmBridge({
      apiKey,
      baseURL: endpoint,
      model: modelId,
      systemPrompt: options.systemPrompt || 'You are an autonomous agent capable of running bash commands, inspecting files, executing python scripts, and modifying the filesystem to achieve the user goal.',
      tools: finalTools,
      defaultHeaders,
      dangerouslyAllowBrowser: true,
    });

    // 3. Execution Loop
    const messages: any[] = [
      { role: 'user', content: prompt }
    ];
    const executedToolCalls: ToolCallRecord[] = [];
    let iterations = 0;
    let finalOutput = '';
    let isFinished = false;

    while (!isFinished && iterations < maxIterations) {
      iterations++;
      log(`Starting iteration ${iterations}/${maxIterations}`, 'info');

      if (verbose) {
        console.group(`⚙️ Iteration ${iterations}`);
      }

      // Call LLM
      const choice = await llm.chat(messages);
      const assistantMsg = choice.message;

      messages.push(assistantMsg);

      if (assistantMsg.content) {
        finalOutput = assistantMsg.content;
        if (verbose) {
          console.log(`💬 Agent Response:`, assistantMsg.content);
        }
      }

      const toolCalls = assistantMsg.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls means agent has completed task
        isFinished = true;
        if (verbose) {
          console.groupEnd();
        }
        break;
      }

      if (options.onStep) {
        options.onStep({ iteration: iterations, toolCalls, response: assistantMsg.content || undefined });
      }

      // Process tool calls
      for (const tc of toolCalls as any[]) {
        const fnName = tc.function?.name || 'unknown';
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          fnArgs = tc.function?.arguments;
        }

        if (verbose) {
          console.log(`🛠️ Tool Call: ${fnName}`, fnArgs);
        }

        let toolResultStr = '';
        const matchedTool = finalTools.find((t) => {
          const name = t.definition?.function?.name || t.name || t.definition?.name;
          return name === fnName;
        });

        const fn = matchedTool?.handler || matchedTool?.execute;

        if (matchedTool && typeof fn === 'function') {
          try {
            const rawResult = await fn(fnArgs, { sandbox, fs: sandbox.fs });
            toolResultStr = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
          } catch (err: any) {
            toolResultStr = `Tool Error: ${err?.message || String(err)}`;
          }
        } else {
          toolResultStr = `Error: Tool '${fnName}' not found.`;
        }

        const toolRecord: ToolCallRecord = { name: fnName, args: fnArgs, result: toolResultStr };
        executedToolCalls.push(toolRecord);

        if (options.onToolCall) {
          options.onToolCall(toolRecord);
        }

        if (verbose) {
          console.log(`📤 Tool Output [${fnName}]:`, toolResultStr);
        }

        log(`Executed ${fnName}`, 'tool');

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResultStr,
        });
      }

      if (verbose) {
        console.groupEnd();
      }
    }

    if (verbose) {
      console.log(`✅ Agent finished in ${iterations} iterations.`);
      console.groupEnd();
    }

    log(`Agent task complete in ${iterations} iterations`, 'result');

    return {
      success: true,
      output: finalOutput,
      iterations,
      messages,
      toolCalls: executedToolCalls,
    };

  } catch (err: any) {
    if (verbose) {
      console.error(`❌ Agent Error:`, err);
      console.groupEnd();
    }
    log(`Agent Error: ${err?.message || String(err)}`, 'error');

    return {
      success: false,
      output: err?.message || String(err),
      iterations: 0,
      messages: [],
      toolCalls: [],
    };
  }
}

if (typeof window !== 'undefined') {
  (window as any).agent = agent;
}
