# web-bash-agent

An pure vanilla JS (TypeScript) implementation for an in-browser agent to attach to your site using [`just-bash`](https://github.com/vercel-labs/just-bash). 

You can choose to mount filesystems for the agent to access using a virtual, in-browser filesystem. The system is meant to be extensible to with customized tools and commands you can register in the virtual filesystem.

## Usage

```bash
# install
pnpm i web-bash-agent
```

## Usage

### Setting up the worker

It's best not to expose your API keys directly on the client, so there is a light Cloudflare worker you can set up to proxy requests. OpenRouter is used due simplicity and wide availability of free-use models. 

To prevent the API system from unauthorized use, we support Cloudflare Turnstile (CAPTCHA), and you can set authorized hosts using `ALLOWED_ORIGINS`.

```bash
cd ~/bash-agent/worker 

# copy over the wrangler.toml.example to wrangler.toml
cp wrangler.toml.example wrangler.toml

# make sure to set variables inside wrangler.toml, or
# use pnpm dlx wrangler secret put <variable-name> 

# deploy
pnpm dlx wrangler deploy
```

### Client / Static-Site Setup

`web-bash-agent` runs entirely in the browser, making it compatible with static sites (e.g., Astro SSG, Vite, Next.js static exports) hosted on platforms like GitHub Pages. 

It works by bundling designated repository files into a serialized virtual filesystem during your build step (SSG), which the browser then loads at runtime.

### 1. Installation

Install the package via your favorite package manager:

```bash
npm install web-bash-agent
# or
pnpm add web-bash-agent
# or
yarn add web-bash-agent
```

---

### 2. Build-Time Setup (SSG / Static Generation)

During your site's build step (e.g., in Astro frontmatter, or a static build script), use the Node-safe helper `getAgentContextFilesystem` to map and package local workspace directories:

```typescript
// This code executes only at build time (Node environment)
import { getAgentContextFilesystem } from 'web-bash-agent/server';
import path from 'node:path';

const repoRoot = process.cwd();

// Package local workspace folders into a virtual filesystem tree
const filesystem = getAgentContextFilesystem({
  "/.agents": path.join(repoRoot, ".agents"),
  "/src": path.join(repoRoot, "src"),
});

// Serialize this `filesystem` object into your HTML page (e.g., via a JSON script tag)
```

For example, in an Astro layout:

```html
<script
  id="agent-sidebar-config"
  type="application/json"
  set:html={JSON.stringify({ filesystem })}
/>
```

---

### 3. Browser Runtime Setup

In your client-side script running in the browser, initialize the `AgentSidebar`:

```typescript
// This code runs entirely in the browser
import { AgentSidebar } from 'web-bash-agent';

export async function initAgent() {
  // Retrieve the pre-bundled filesystem tree from the HTML
  const configEl = document.getElementById('agent-sidebar-config');
  const config = JSON.parse(configEl?.textContent || '{}');

  const sidebar = new AgentSidebar({
    models: [
      {
        id: "your-model-id",
        name: "Model Name",
        endpoint: "https://your-llm-proxy-url",
        keyIdentifier: "PROVIDER_API_KEY",
        routerUrl: "https://api.your-provider.com/v1",
      }
    ],
    filesystem: config.filesystem, // Load the virtual filesystem
    customBashCommands: (ctx) => [
      // Register custom bash-like tools here
    ]
  });

  // Mount the sidebar UI
  document.body.appendChild(sidebar.getElement());
  sidebar.init();
}
```

---

### 4. Custom Commands (Optional)

You can extend the agent's shell with custom commands/tools using `defineCommand` (from `just-bash/browser`):

```typescript
import { defineCommand } from 'just-bash/browser';

export function createNavigateCommand() {
  return defineCommand("navigate", async (args) => {
    if (args.length === 0) {
      return { stdout: "", stderr: "Usage: navigate <url>\n", exitCode: 1 };
    }
    
    const url = args[0];
    window.location.assign(url);
    
    return { 
      stdout: `Navigating to ${url}...\n`, 
      stderr: "", 
      exitCode: 0 
    };
  });
}
```

Then register it under `customBashCommands` during initialization:

```typescript
customBashCommands: (ctx) => [
  createNavigateCommand()
]
```