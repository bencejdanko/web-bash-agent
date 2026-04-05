import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

/**
 * MCP Tool implementation.
 * Wraps an MCP server's tools and allows the LLM to call them.
 */
export async function createMcpTool(serverUrl: string) {
  const transport = new SSEClientTransport(new URL("/sse", serverUrl));
  const client = new Client(
    {
      name: "pagefind-agent-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  // Lists all tools provided by the server
  const { tools } = await client.listTools();

  // Return a list of AgentTool objects, one for each MCP tool
  return tools.map((mcpTool) => ({
    definition: {
      type: "function",
      function: {
        name: mcpTool.name,
        description: mcpTool.description,
        parameters: mcpTool.inputSchema,
      },
    },
    handler: async (args: any) => {
      const result = await client.callTool({
        name: mcpTool.name,
        arguments: args,
      });
      
      if (result.isError) {
        throw new Error(JSON.stringify(result.content));
      }
      
      return (result.content as any[]).map((c: any) => {
        if (c.type === "text") return c.text;
        if (c.type === "image") return `[Image: ${c.data.substring(0, 50)}...]`;
        return JSON.stringify(c);
      }).join("\n");
    },
  }));
}

import { defineCommand } from "just-bash";

/**
 * Creates a bash command that wraps an MCP tool.
 */
export async function createMcpCommand(serverUrl: string, toolName: string) {
  const transport = new SSEClientTransport(new URL("/sse", serverUrl));
  const client = new Client(
    { name: "pagefind-agent-bash", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  return defineCommand(toolName, async (args) => {
    // Basic argument parsing: assume first arg is query or JSON
    const toolArgs = args.length === 1 && args[0].startsWith("{") 
      ? JSON.parse(args[0]) 
      : { query: args.join(" ") };

    const result = await client.callTool({
      name: toolName,
      arguments: toolArgs,
    });

    if (result.isError) {
      return { stdout: "", stderr: JSON.stringify(result.content), exitCode: 1 };
    }

    const output = (result.content as any[]).map(c => c.text || JSON.stringify(c)).join("\n");
    return { stdout: output + "\n", stderr: "", exitCode: 0 };
  });
}

/**
 * Creates bash commands for ALL tools provided by an MCP server.
 */
export async function createMcpCommands(serverUrl: string) {
  const transport = new SSEClientTransport(new URL("/sse", serverUrl));
  const client = new Client(
    { name: "pagefind-agent-bash-bulk", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  const { tools } = await client.listTools();

  return Promise.all(tools.map(async (mcpTool) => {
    return defineCommand(mcpTool.name, async (args) => {
      // Basic argument parsing: assume first arg is query or JSON
      const toolArgs = args.length === 1 && args[0].startsWith("{") 
        ? JSON.parse(args[0]) 
        : { query: args.join(" ") };

      const result = await client.callTool({
        name: mcpTool.name,
        arguments: toolArgs,
      });

      if (result.isError) {
        return { stdout: "", stderr: JSON.stringify(result.content), exitCode: 1 };
      }

      const output = (result.content as any[]).map(c => c.text || JSON.stringify(c)).join("\n");
      return { stdout: output + "\n", stderr: "", exitCode: 0 };
    });
  }));
}

