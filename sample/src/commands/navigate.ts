import { defineCommand } from "just-bash/browser";

/**
 * Command: navigate "url" [--replace]
 * Navigates the browser to the specified URL.
 * Supports /local paths and full https:// URLs.
 */
export function createNavigateCommand() {
  return defineCommand("navigate", async (args) => {
    if (args.length === 0) {
      return { 
        stdout: "", 
        stderr: "Usage: navigate <url> [--replace]\n", 
        exitCode: 1 
      };
    }

    const url = args[0];
    const options = {
        history: args.includes('--replace') ? 'replace' : 'push'
    };

    try {
      // @ts-ignore
      const nav = window.navigate || (window.astro && window.astro.navigate);
      
      if (typeof nav === 'function') {
        nav(url, options);
      } else {
        // Fallback to standard location change
        if (options.history === 'replace') {
          window.location.replace(url);
        } else {
          window.location.assign(url);
        }
      }

      return { 
        stdout: `Navigating to ${url}...\n`, 
        stderr: "", 
        exitCode: 0 
      };
    } catch (error: any) {
      return { 
        stdout: "", 
        stderr: `Navigation failed: ${error.message}\n`, 
        exitCode: 1 
      };
    }
  });
}
