import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for serving files
  root: '.',

  // Base public path
  base: './',

  // Build configuration
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2015',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        help: resolve(__dirname, 'help.html'),
      },
      output: {
        // Organize build output
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },

  // Server configuration for development
  server: {
    port: 8888,
    open: true,
  },

  // Preview server (for testing production builds)
  preview: {
    port: 8889,
    open: true,
  },
});
