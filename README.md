# bash-agent

An pure vanilla JS (TypeScript) implementation for an in-browser agent to attach to your site using [`just-bash`](https://github.com/vercel-labs/just-bash). 

You can choose to mount filesystems for the agent to access using a virtual, in-browser filesystem. The system is meant to be extensible to with customized tools and commands you can register in the virtual filesystem.

## Usage

```bash
# install
pnpm i bash-agent
```

## Usage


## Setting up the worker

It's best not to expose your API keys directly on the client, so there is a light Cloudflare worker you can set up to proxy requests. OpenRouter is used due simplicity and wide availability of free-use models. 

To toggle what models you want available for your service, edit the list in `workers/index.ts`. By default, these are set:

```typescript
const APPROVED_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b",
  "Qwen/Qwen3.5-27B"
];
```

Then, add your openrouter key to the worker and deploy:

```bash
cd ~/bash-agent/worker 

# add your token to the worker
pnpm dlx wrangler secret put OPENROUTER_TOKEN

# also add your TURNSTILE_SECRET_KEY to the worker (Cloudflare CAPTCHA)
pnpm dlx wrangler secret put TURNSTILE_SECRET_KEY

pnpm dlx wrangler secret put TURNSTILE_SECRET_KEY

pnpm dlx wrangler secret put TURNSTILE_SECRET_KEY


# deploy
pnpm dlx wrangler deploy
```

Note the 