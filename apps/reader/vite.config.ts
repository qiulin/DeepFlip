import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tsConfigPaths(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['foliate-js'],
  },
});
