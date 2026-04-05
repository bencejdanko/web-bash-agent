import { bashTool } from './tools/bash';
import { createLoadSkillTool } from './tools/load_skill';
import { createMcpTool, createMcpCommand, createMcpCommands } from './tools/mcp';



type ToolFactory = (config: any, context: { skills: any[] }) => any;
type CommandFactory = (config: any, context: { pagefind: any }) => any;

class Registry {
  private toolFactories = new Map<string, ToolFactory>();
  private commandFactories = new Map<string, CommandFactory>();

  constructor() {
    // 1. Register Default Tool Factories
    this.registerTool('bash', () => bashTool);
    this.registerTool('load-skill', (config, { skills }) => createLoadSkillTool(skills));
    this.registerTool('mcp', (config) => createMcpTool(config.serverUrl));

    // 2. Register Default Command Factories
    this.registerCommand('mcp', (config) => createMcpCommand(config.serverUrl, config.toolName));
    this.registerCommand('mcp-server', (config) => createMcpCommands(config.serverUrl));


  }

  registerTool(type: string, factory: ToolFactory) {
    this.toolFactories.set(type, factory);
  }

  registerCommand(type: string, factory: CommandFactory) {
    this.commandFactories.set(type, factory);
  }

  async getTool(config: any, context: { skills: any[] }) {
    if (!config || typeof config.type !== 'string') return config;
    const factory = this.toolFactories.get(config.type);
    if (!factory) return null;
    return await factory(config, context);
  }

  async getCommand(config: any, context: { pagefind: any }) {
    if (!config || typeof config.type !== 'string') return config;
    const factory = this.commandFactories.get(config.type);
    if (!factory) return null;
    return await factory(config, context);
  }
}

export const registry = new Registry();
