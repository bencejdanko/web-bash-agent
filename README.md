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