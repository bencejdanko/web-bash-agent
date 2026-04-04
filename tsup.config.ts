import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disabling DTS for now to allow dev workflow to proceed
  clean: true,
  minify: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'astro'],
  treeshake: true,
});
