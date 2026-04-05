export interface Env {
  [key: string]: string;
}

const APPROVED_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b"
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const model = body.model;

      if (!APPROVED_MODELS.includes(model)) {
        return new Response(`Model ${model} is not approved for this proxy.`, { status: 403 });
      }

      const routerUrl = request.headers.get("X-Router-URL") || "https://openrouter.ai/api/v1";
      const keyIdentifier = request.headers.get("X-Key-Identifier") || "OPENROUTER_TOKEN";
      const apiKey = env[keyIdentifier];

      if (!apiKey) {
        return new Response(`API key for identifier ${keyIdentifier} not found in environment`, { status: 400 });
      }
      
      const response = await fetch(`${routerUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://pagefind-bash-agent-astro.pages.dev", 
          "X-Title": "Pagefind Bash Agent",
        },
        body: JSON.stringify(body),
      });

      if (!response.body) {
        return new Response("No response body from router", { status: 500 });
      }

      // Forward the streaming response
      const { readable, writable } = new TransformStream();
      response.body.pipeTo(writable);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");

      return new Response(readable, {
        headers
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return new Response(errorMessage, { status: 500 });
    }
  },
};
