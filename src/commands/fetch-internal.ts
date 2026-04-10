import { defineCommand } from "just-bash/browser";

/**
 * Command: fetch-internal "url"
 * Use browser standard fetch to pull a DOM response and convert to markdown.
 */
export function createFetchInternalCommand() {
  return defineCommand("fetch-internal", async (args) => {
    if (args.length === 0) {
      return { stdout: "", stderr: "Usage: fetch-internal <url>\n", exitCode: 1 };
    }

    const url = args[0];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { 
          stdout: "", 
          stderr: `Failed to fetch: ${response.status} ${response.statusText}\n`, 
          exitCode: 1 
        };
      }

      const html = await response.text();
      // Use standard DOM parser if available
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Basic text extraction, focusing on main content
      const content = doc.body.innerText;
      const strippedContent = content.substring(0, 5000); // 5k limit to avoid token blow up

      return { 
        stdout: `Content for ${url}:\n\n${strippedContent}\n`, 
        stderr: "", 
        exitCode: 0 
      };
    } catch (error: any) {
      return { 
        stdout: "", 
        stderr: `Failed to fetch: ${error.message}\n`, 
        exitCode: 1 
      };
    }
  });
}
