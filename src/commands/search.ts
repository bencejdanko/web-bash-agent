import { defineCommand } from "just-bash/browser";

/**
 * Command: search "query"
 * Uses Pagefind to search the site's indexed content.
 */
export function createSearchCommand(pagefind: any) {
  return defineCommand("search", async (args) => {
    if (!pagefind) {
      return { 
        stdout: "", 
        stderr: "Pagefind not initialized. Build the site and ensure pagefind.js is loaded.\n", 
        exitCode: 1 
      };
    }

    const query = args.join(" ");
    if (!query) {
      return { stdout: "", stderr: "Usage: search <query>\n", exitCode: 1 };
    }

    try {
      const searchResult = await pagefind.search(query);
      const results = await Promise.all(searchResult.results.map((r: any) => r.data()));

      if (results.length === 0) {
        return { stdout: `No results found for "${query}".\n`, stderr: "", exitCode: 0 };
      }

      const output = results.slice(0, 5).map((res: any, i: number) => {
        return `${i + 1}. [${res.meta.title}](${res.url})\n   ${res.excerpt}\n`;
      }).join("\n");

      return { 
        stdout: `Found ${results.length} results (showing top 5):\n\n${output}\n`, 
        stderr: "", 
        exitCode: 0 
      };
    } catch (error: any) {
      return { 
        stdout: "", 
        stderr: `Search failed: ${error.message}\n`, 
        exitCode: 1 
      };
    }
  });
}
