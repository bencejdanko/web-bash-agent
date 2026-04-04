export function GET() {
  return new Response(JSON.stringify({
    title: "Tldraw Astro",
    description: "A robust integration for tldraw diagrams in Astro",
    tech_stack: ["Astro", "React", "tldraw"],
    body: "This project allows for seamless tldraw integration within Astro projects."
  }), { headers: { 'Content-Type': 'application/json' } });
}
