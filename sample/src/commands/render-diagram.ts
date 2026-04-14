import { defineCommand } from "just-bash/browser";

/**
 * Command: render-diagram <file> [type]
 * Renders a diagram using the Kroki.io API.
 * Default type is 'mermaid'.
 */
export function createRenderDiagramCommand(context: { getFs: () => any }) {
  return defineCommand("render-diagram", async (args) => {
    if (args.length === 0) {
      return { 
        stdout: "", 
        stderr: "Usage: render-diagram <file> [type]\n", 
        exitCode: 1 
      };
    }

    const filePath = args[0];
    const type = args[1] || "mermaid";
    const fs = context.getFs();

    if (!fs) {
      return { 
        stdout: "", 
        stderr: "Filesystem not available\n", 
        exitCode: 1 
      };
    }

    try {
      // Read file content from the virtual filesystem
      const content = await fs.readFile(filePath, "utf8");
      
      if (content === undefined || content === null) {
        return { 
          stdout: "", 
          stderr: `Error: File ${filePath} not found.\n`, 
          exitCode: 1 
        };
      }

      // POST to Kroki API
      const response = await fetch(`https://kroki.io/${type}/svg`, {
        method: "POST",
        body: content,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          stdout: "", 
          stderr: `Kroki API error (${response.status}): ${errorText || response.statusText}\n`, 
          exitCode: 1 
        };
      }

      const svg = await response.text();
      return { 
        stdout: svg + "\n", 
        stderr: "", 
        exitCode: 0 
      };
    } catch (error: any) {
      return { 
        stdout: "", 
        stderr: `Failed to render diagram: ${error.message}\n`, 
        exitCode: 1 
      };
    }
  });
}
