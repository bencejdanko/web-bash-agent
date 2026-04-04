export class BashEngine {
  constructor(private filesystem: Record<string, string>, private pagefind: any) {}

  private parseCommand(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes: string | null = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      if (char === '"' || char === "'") {
        if (inQuotes === char) {
          inQuotes = null;
        } else if (!inQuotes) {
          inQuotes = char;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current.length > 0) {
      args.push(current);
    }
    return args;
  }

  async run(command: string): Promise<string> {
    const args = this.parseCommand(command);
    if (args.length === 0) return '';
    
    const cmd = args[0];

    if (cmd === 'ls') {
      const path = args[1] || '/';
      const files = Object.keys(this.filesystem)
        .filter(f => f.startsWith(path))
        .map(f => f.replace(path, '').replace(/^\//, ''))
        .filter(f => f.length > 0)
        .map(f => f.split('/')[0]);
      
      const uniqueFiles = Array.from(new Set(files)).sort();
      return uniqueFiles.length > 0 ? uniqueFiles.join('\n') : 'ls: directory not found';
    }

    if (cmd === 'grep') {
      // Find query (handle -i flag)
      let queryIndex = 1;
      let ignoreCase = false;
      
      while (args[queryIndex] && args[queryIndex].startsWith('-')) {
        if (args[queryIndex].includes('i')) ignoreCase = true;
        queryIndex++;
      }
      
      const query = args[queryIndex];
      if (!query) return 'grep: missing pattern';

      const pf = this.pagefind || (typeof window !== 'undefined' ? (window as any).pagefind : null);
      if (!pf) return 'grep: Pagefind index not loaded';
      
      try {
        const searchResult = await pf.search(query);
        if (!searchResult || !searchResult.results || searchResult.results.length === 0) return '';
        
        const snippets = await Promise.all(
          searchResult.results.slice(0, 5).map(async (res: any) => {
            const data = await res.data();
            return `${data.url}: ${data.excerpt}`;
          })
        );
        return snippets.join('\n');
      } catch (e) {
        return `grep: error searching - ${e}`;
      }
    }

    if (cmd === 'cat') {
      const path = args[1];
      if (!path) return 'cat: missing file';
      
      if (this.filesystem[path]) {
        return this.filesystem[path];
      }

      try {
        const response = await fetch(path);
        if (response.ok) {
          const contentType = response.headers.get('Content-Type');
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            return JSON.stringify(data, null, 2);
          }
          return await response.text();
        }
        return `cat: ${path}: No such file or directory (HTTP ${response.status})`;
      } catch (e) {
        return `cat: ${path}: Network error or file not found`;
      }
    }

    return `bash: ${cmd}: command not found`;
  }
}
