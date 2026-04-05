---
name: web-search
description: Search the web for information using a search engine.
license: MIT
---

# Web Search Skill

Use this skill when you need to find information that is not available in the local site content or you need to visit external URLs.

## Instructions

1.  **Identify the need**: Use this if the local `search` (Pagefind) or local files don't contain the answer.
2.  **Search the web**: Use the `web-search "your query"` command in the bash tool. This will return search results with summaries.
3.  **Fetch content**: If a specific search result looks promising, or if the user provides a direct URL, use the `web-fetch "url"` command to get the full markdown content of that page.
4.  **Synthesize**: Combine the information from the web with your local knowledge to provide a comprehensive answer.
5.  **Cite**: Always mention the source URLs in your final response.

