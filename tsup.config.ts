import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'index.ts',
    server: 'src/server.ts',
  },
  format: ['esm'],
  target: 'es2020', 
  dts: true, 
  splitting: false,
  clean: false,
  minify: false,
  sourcemap: false,
  external: [],
  treeshake: true,
  injectStyle: true,
  outDir: 'dist',
});
