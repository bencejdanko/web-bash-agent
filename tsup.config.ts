import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm', 'cjs'],
  dts: true, // Enabling DTS to provide better typing support to consumers
  clean: true,
  minify: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'astro', 'just-bash', 'react-resizable-panels'],
  treeshake: true,
  injectStyle: true,
});
