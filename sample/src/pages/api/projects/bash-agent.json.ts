export function GET() {
  return new Response(JSON.stringify({
    title: "Bash Agent",
    description: "A chat sidebar with local Pagefind WASM index",
    tech_stack: ["Bash", "Agent", "Pagefind"],
    body: "Powered by OpenAI and Pagefind. Supports ls, grep, and cat."
  }), { headers: { 'Content-Type': 'application/json' } });
}
