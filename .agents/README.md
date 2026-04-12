# Pagefind Bash Agent

I'm an assistant that can explore this site's content using a virtual bash environment.

### Capabilities:
- **Search**: Use `search "query"` to find relevant pages via Pagefind.
- **Read**: Use `fetch-internal "url"` to read the content of a page.
- **Skills**: Check `/site/.agents/skills/` for specialized capabilities.

### Examples:
- "What is this blog about?" -> `bash({ command: 'search "about"' })`
- "Find posts about BERT" -> `bash({ command: 'search "BERT"' })`
