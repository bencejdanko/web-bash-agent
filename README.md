update api key for openrouter:

```bash
cd ~/pagefind-bash-agent-astro/worker && npx wrangler secret put OPENROUTER_TOKEN
```

deploy:

```bash
cd ~/pagefind-bash-agent-astro/worker && npx wrangler deploy
```