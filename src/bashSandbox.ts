/**
 * BashSandbox: A full virtual bash environment powered by just-bash,
 * with Pagefind integration via a custom `search` command.
 *
 * Replaces the limited 3-command BashEngine with a real bash shell
 * that supports 80+ commands, pipes, redirections, globs, and more.
 */
import { Bash, defineCommand } from 'just-bash';

export interface BashSandboxOptions {
  /** Files to pre-load into the virtual filesystem under /site/ */
  files?: Record<string, string>;
  /** Pagefind instance for full-text search */
  pagefind?: any;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create the custom `search` command that wraps Pagefind.
 * This gives the agent full-text search as a natural shell command:
 *   search "my query"
 *   search accessibility | head -5
 */
function createSearchCommand(pagefind: any) {
  return defineCommand('search', async (args, _ctx) => {
    const query = args.join(' ');
    if (!query) {
      return {
        stdout: '',
        stderr: 'Usage: search <query>\nPerforms full-text search across the entire site.\n',
        exitCode: 1,
      };
    }

    if (!pagefind) {
      return {
        stdout: '',
        stderr: 'search: Pagefind index not loaded. File-based search via grep is still available.\n',
        exitCode: 1,
      };
    }

    try {
      const result = await pagefind.search(query);
      if (!result?.results?.length) {
        return { stdout: 'No results found.\n', stderr: '', exitCode: 0 };
      }

      const lines = await Promise.all(
        result.results.slice(0, 8).map(async (r: any) => {
          const data = await r.data();
          const title = data.meta?.title || data.url || 'Untitled';
          const excerpt = (data.excerpt || '').replace(/<[^>]*>/g, '').trim();
          return `${data.url}\t${title}\n  ${excerpt}`;
        })
      );

      return { stdout: lines.join('\n\n') + '\n', stderr: '', exitCode: 0 };
    } catch (e) {
      return {
        stdout: '',
        stderr: `search: error - ${e}\n`,
        exitCode: 1,
      };
    }
  });
}

/**
 * Create a `help` override that includes our custom search command
 * in the available commands listing.
 */
function createSiteHelpCommand() {
  return defineCommand('site-help', async (_args, _ctx) => {
    return {
      stdout: [
        'Site Explorer - Virtual Bash Environment',
        '=========================================',
        '',
        'The site content is in /site/. Use standard bash commands to explore:',
        '',
        '  ls /site/              List site content',
        '  find /site -name "*.json"   Find files by pattern',
        '  cat /site/path/file    Read a file',
        '  grep -r "term" /site/  Search within files',
        '  cat file.json | jq .   Parse JSON',
        '',
        'Custom commands:',
        '  search <query>         Full-text search via Pagefind',
        '  site-help              Show this help',
        '',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    };
  });
}

export class BashSandbox {
  private bash: Bash;

  constructor(options: BashSandboxOptions = {}) {
    // Build the filesystem: mount everything under /site/
    const files: Record<string, string> = {};

    if (options.files) {
      for (const [path, content] of Object.entries(options.files)) {
        const normalizedPath = path.startsWith('/site/')
          ? path
          : `/site${path.startsWith('/') ? '' : '/'}${path}`;
        files[normalizedPath] = content;
      }
    }

    // Add a welcome README
    files['/site/README.md'] = [
      '# Site Content',
      '',
      'This virtual filesystem contains the site\'s content.',
      'Use standard bash commands to explore.',
      '',
      'Try: ls, find, cat, grep, jq',
      'For full-text search: search "your query"',
      'For help: site-help',
    ].join('\n');

    // Build custom commands
    const customCommands = [
      createSearchCommand(options.pagefind),
      createSiteHelpCommand(),
    ];

    this.bash = new Bash({
      files,
      cwd: '/site',
      customCommands,
    });
  }

  /**
   * Execute a bash command in the virtual environment.
   * Returns stdout, stderr, and exit code.
   */
  async exec(command: string): Promise<ExecResult> {
    try {
      const result = await this.bash.exec(command);
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode ?? 0,
      };
    } catch (e) {
      return {
        stdout: '',
        stderr: `Internal error: ${e}\n`,
        exitCode: 127,
      };
    }
  }

  /**
   * Get the current working directory of the shell.
   */
  getCwd(): string {
    return (this.bash as any).cwd || '/site';
  }
}
