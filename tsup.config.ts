import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'index.ts',
    integration: 'integration.ts',
    AgentIsland: 'src/AgentIsland.tsx',
  },
  format: ['esm'],
  dts: true, 
  splitting: false,
  clean: false,
  minify: false,
  sourcemap: true,
  external: ['react', 'react-dom', 'astro', 'just-bash', 'react-resizable-panels', 'openai'],
  treeshake: true,
  injectStyle: true,
  outDir: 'dist',
});
