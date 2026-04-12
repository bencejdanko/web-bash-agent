---
name: search
description: Search the local site content using Pagefind.
license: MIT
---

# Search Skill

Use this skill when you need to find information available in the local site content.

## Instructions

1. **Identify Query**: Extract the most relevant keywords from the user's request.
2. **Execute Search**: Use the bash command `search "<query>"` inside the `bash` tool.
3. **Examine Results**: If results are found, use `fetch-internal "<url>"` to read the most promising pages.

Example: If looking for "BERT", run `search "BERT"`.