export interface Env {
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_PER_MINUTE?: string | number;
  TURNSTILE_SECRET_KEY?: string;
  [key: string]: any;
}

const APPROVED_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b",
  "Qwen/Qwen3.5-27B"
];

// In-memory rate limiting map (applies per V8 isolate instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string, limit: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return false;
  }
  
  if (record.count >= limit) {
    return true;
  }
  
  record.count++;
  return false;
}

// Dynamically generate CORS headers based on configured ALLOWED_ORIGINS env var
function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = (env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());
  
  let allowedOrigin = "*";
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    allowedOrigin = origin;
  }
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "X-Session-Token",
  };
}

// Verify Turnstile Token using Cloudflare Turnstile API
async function verifyTurnstile(token: string, secretKey: string, remoteIp?: string): Promise<boolean> {
  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }
  
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const outcome: any = await res.json();
    return !!outcome.success;
  } catch (e) {
    console.error("Turnstile verification error:", e);
    return false;
  }
}

// Generate HMAC-SHA256 Session Token
async function generateSessionToken(ip: string, secretKey: string): Promise<string> {
  const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes session validity
  const data = `${ip}:${expiry}`;
  
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secretKey);
  const dataBuf = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw", 
    keyBuf, 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuf);
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
    
  return `${data}:${sigHex}`;
}

// Verify HMAC-SHA256 Session Token
async function verifySessionToken(token: string, ip: string, secretKey: string): Promise<boolean> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;
    
    const [tokenIp, expiryStr, sigHex] = parts;
    const expiry = parseInt(expiryStr, 10);
    
    if (tokenIp !== ip) return false;
    if (Date.now() > expiry) return false;
    
    const data = `${tokenIp}:${expiryStr}`;
    const encoder = new TextEncoder();
    const keyBuf = encoder.encode(secretKey);
    const dataBuf = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw", 
      keyBuf, 
      { name: "HMAC", hash: "SHA-256" }, 
      false, 
      ["verify"]
    );
    
    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return await crypto.subtle.verify("HMAC", cryptoKey, sigBytes, dataBuf);
  } catch (e) {
    console.error("Session verification error:", e);
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    
    // 1. IP Rate limiting (V8-isolate level)
    const rateLimitVal = env.RATE_LIMIT_PER_MINUTE ? parseInt(String(env.RATE_LIMIT_PER_MINUTE), 10) : 20;
    if (isRateLimited(ip, rateLimitVal)) {
      return new Response("Too many requests", { 
        status: 429,
        headers: corsHeaders(request, env)
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(request, env),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: corsHeaders(request, env)
      });
    }

    // 2. Turnstile / Session Token verification (if secret key is set)
    let newSessionToken: string | null = null;
    
    if (env.TURNSTILE_SECRET_KEY) {
      const sessionToken = request.headers.get("X-Session-Token");
      const turnstileToken = request.headers.get("X-Turnstile-Token");
      
      let authenticated = false;
      
      if (sessionToken) {
        authenticated = await verifySessionToken(sessionToken, ip, env.TURNSTILE_SECRET_KEY);
      }
      
      if (!authenticated && turnstileToken) {
        const isTurnstileValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
        if (isTurnstileValid) {
          authenticated = true;
          newSessionToken = await generateSessionToken(ip, env.TURNSTILE_SECRET_KEY);
        }
      }
      
      if (!authenticated) {
        return new Response("Unauthorized: Invalid or missing CAPTCHA or Session token.", {
          status: 401,
          headers: corsHeaders(request, env)
        });
      }
    }

    try {
      const body = await request.json();
      const model = body.model;

      if (!APPROVED_MODELS.includes(model)) {
        return new Response(`Model ${model} is not approved for this proxy.`, { 
          status: 403,
          headers: corsHeaders(request, env)
        });
      }

      const routerUrl = request.headers.get("X-Router-URL") || "https://openrouter.ai/api/v1";
      const keyIdentifier = request.headers.get("X-Key-Identifier") || "OPENROUTER_TOKEN";
      const apiKey = env[keyIdentifier];

      if (!apiKey) {
        return new Response(`API key for identifier ${keyIdentifier} not found in environment`, { 
          status: 400,
          headers: corsHeaders(request, env)
        });
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

      const headers = new Headers(response.headers);
      Object.entries(corsHeaders(request, env)).forEach(([k, v]) => headers.set(k, v));
      
      // Inject the new session token if it was generated
      if (newSessionToken) {
        headers.set("X-Session-Token", newSessionToken);
      }

      if (!response.body) {
        return new Response("No response body from router", { 
          status: response.status,
          headers 
        });
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return new Response(errorMessage, { 
        status: 500,
        headers: corsHeaders(request, env)
      });
    }
  },
};
