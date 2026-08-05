# Pugilister

> Punch above your weight

Pugilister is a headless browser agent runtime that lives **100% in the browser**. No Docker, no VMs, no backend. Every tool call runs inside a WebAssembly virtual machine — Python (Pyodide), SQL (DuckDB), bash, and a filesystem — all client-side.

---

## Why Pugilister?

Most AI agent platforms pay heavy cloud bills because agent compute runs inside backend Docker containers or micro-VMs. Pugilister moves 100% of compute into the client's browser. That means **$0 infrastructure cost per agent run**.

---

## Installation

```bash
npm i pugilister
# or
pnpm i pugilister
```

---

## Setup

### Vite · Astro · SvelteKit · Nuxt · Remix

Use `import.meta.glob` to mount files into the virtual filesystem:

```ts
import { initPugilister } from 'pugilister';

// Mount files from your project into the virtual filesystem
const files = import.meta.glob(
  ['/src/content/**/*.{md,json,csv}', '/public/data/*'],
  { query: '?raw', import: 'default', eager: true }
);

initPugilister({ files, commands: ['python', 'duckdb'] });
```

That's it. The agent is now available globally as `agent(prompt)` in DevTools.

### Vanilla HTML (no bundler)

Drop a config `<script>` block and import from a CDN:

```html
<!-- Mount files via JSON in a script tag -->
<script id="pugilister-config" type="application/json">
{
  "files": {
    "/hello.txt": "Hello from the virtual filesystem!",
    "/data.csv": "name,age\nAlice,30\nBob,25"
  }
}
</script>

<script type="module">
  import { initPugilister } from 'https://esm.sh/pugilister';
  initPugilister({ commands: ['python', 'duckdb'] });
</script>
```

Open DevTools (F12) and run:
```js
await agent('Read data.csv and compute the average age in Python');
```

---

## Built-in Commands

| Name | Description |
|---|---|
| `'python'` | Python 3.12 via Pyodide WebAssembly. File sync with VFS. |
| `'duckdb'` | DuckDB SQL engine. Supports CSV, JSON, Parquet. |
| `'open'` | Native OS file picker -> mounts selected file(s) into VFS. |
| `'save'` | Native OS save dialog -> saves a VFS file to user's disk. |
| `'open-dir'` | Native OS folder picker -> mounts directory tree into VFS. |

Default (when `commands` is omitted): all built-ins are loaded.

---

## Custom Commands

Pass pre-instantiated command objects alongside string names:

```ts
import { initPugilister, defineCommand } from 'pugilister';

const myCommand = defineCommand('greet', async (args) => ({
  stdout: `Hello, ${args[0] || 'world'}!\n`,
  stderr: '',
  exitCode: 0,
}));

initPugilister({
  files,
  commands: ['python', myCommand],
});
```

---

## DevTools Usage

After `initPugilister()` runs, these globals are available in the browser console:

```js
// Run the agent
await agent('Analyse my CSV data and create a chart');

// Run bash commands directly
await bash('ls /');
await bash`python -c "print(2 + 2)"`;

// Interactive REPLs
await python();    // Opens Python REPL
await duckdb();    // Opens DuckDB REPL

// Filesystem
await fs.ls('/');
await fs.cat('/data.csv');
await fs.write('/output.txt', 'hello');
```


---

## Demonstrations


- **In-Browser Data Analyst** — Agent turns CSV files into charts using Python, zero uploads
- **Offline Document Editor** — Agent parses and edits resumes/PDFs locally
- **Browser DevTools Agent** — Press F12, type `agent(...)` on any site